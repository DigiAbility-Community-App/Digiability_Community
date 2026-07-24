// ─────────────────────────────────────────────────────────────
// notif-svc — Notification Service
//
// Sends Expo push notifications to offline users.
// Triggered by two sources:
//   1. msg:notify   Redis stream  — chat messages (offline recipients)
//   2. POST /internal/notify HTTP — forum answers (from forum-svc)
//
// Device tokens are stored in the PostgreSQL `device_tokens` table
// (public schema, owned by user-svc).
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import http from "http";
import Redis from "ioredis";
import { Pool } from "pg";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

const REDIS_URL   = process.env.REDIS_URL   ?? "redis://:redis_secret@localhost:6379";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const PORT        = parseInt(process.env.PORT ?? "4004", 10);

const STREAM   = "msg:notify";
const F_STREAM = "forum:notify";
const GROUP    = "notif-svc-group";
const CONSUMER = `notif-${process.pid}`;

const STALE_ENTRY_CLAIM_MS   = 60_000;       // reclaim entries pending longer than this
const CLAIM_SWEEP_INTERVAL_MS = 60_000;
const RECEIPT_MIN_AGE_MS  = 15 * 60_000;     // Expo recommends waiting ~15min before checking
const RECEIPT_MAX_AGE_MS  = 24 * 60 * 60_000; // Expo only retains receipts for ~a day
const RECEIPT_SWEEP_INTERVAL_MS = 10 * 60_000;

const expo = new Expo();
let pool: Pool;
let redisClient: Redis;
let isShuttingDown = false;

interface PendingReceipt {
  ticketId: string;
  sentAt: number;
}
let pendingReceipts: PendingReceipt[] = [];

// ─── DB helpers ───────────────────────────────────────────────

async function getDeviceTokens(userId: string): Promise<string[]> {
  const result = await pool.query<{ token: string }>(
    'SELECT token FROM device_tokens WHERE "userId" = $1',
    [userId]
  );
  return result.rows.map((r) => r.token);
}

// ─── Push helper ──────────────────────────────────────────────

async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t))
    .map((to) => ({ to, title, body, data, sound: "default" }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const sentAt = Date.now();
      for (const ticket of tickets) {
        if (ticket.status === "ok") {
          pendingReceipts.push({ ticketId: ticket.id, sentAt });
        } else {
          console.error("[notif-svc] Push ticket error:", ticket.message, ticket.details);
        }
      }
    } catch (err) {
      console.error("[notif-svc] Push send error:", err);
    }
  }
}

// ─── Push receipts — prune tokens Expo reports as dead ────────
// Ticket IDs come back immediately from sendPushNotificationsAsync, but
// the actual delivery receipt (which reveals DeviceNotRegistered, etc.)
// is only available from Expo a short while later. This sweep checks
// receipts in batches and deletes tokens Expo says are gone for good.

async function checkPushReceipts(): Promise<void> {
  const now = Date.now();
  pendingReceipts = pendingReceipts.filter((r) => now - r.sentAt < RECEIPT_MAX_AGE_MS);

  const due = pendingReceipts.filter((r) => now - r.sentAt >= RECEIPT_MIN_AGE_MS);
  if (due.length === 0) return;

  const processedIds = new Set<string>();
  const chunks = expo.chunkPushNotificationReceiptIds(due.map((r) => r.ticketId));

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const id of chunk) processedIds.add(id);

      for (const [id, receipt] of Object.entries(receipts)) {
        if (receipt.status === "error") {
          console.error(`[notif-svc] Push receipt error for ${id}:`, receipt.message);
          const token = receipt.details?.expoPushToken;
          if (receipt.details?.error === "DeviceNotRegistered" && token) {
            await pool.query('DELETE FROM device_tokens WHERE token = $1', [token]);
            console.log("[notif-svc] Pruned stale device token (DeviceNotRegistered)");
          }
        }
      }
    } catch (err) {
      console.error("[notif-svc] Receipt check request failed, will retry next sweep:", err);
      // Leave this chunk's ids out of processedIds so they're retried.
    }
  }

  if (processedIds.size > 0) {
    pendingReceipts = pendingReceipts.filter((r) => !processedIds.has(r.ticketId));
  }
}

// ─── HTTP server — /internal/notify for forum-svc ────────────

interface NotifyRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

function startHttpServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      const [dbOk, redisOk] = await Promise.all([
        withTimeout(pool.query("SELECT 1"), 2000).then(() => true).catch(() => false),
        withTimeout(redisClient.ping(), 2000).then(() => true).catch(() => false),
      ]);
      const healthy = dbOk && redisOk;
      res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: healthy ? "ok" : "degraded", service: "notif-svc", db: dbOk, redis: redisOk }));
      return;
    }

    if (req.method === "POST" && req.url === "/internal/notify") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        try {
          const payload: NotifyRequest = JSON.parse(body);
          if (!payload.userId || !payload.title || !payload.body) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "userId, title, body required" }));
            return;
          }
          const tokens = await getDeviceTokens(payload.userId);
          await sendPush(tokens, payload.title, payload.body, payload.data ?? {});
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ sent: tokens.length }));
        } catch (err) {
          console.error("[notif-svc] /internal/notify error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "internal error" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`[notif-svc] HTTP server listening on :${PORT}`);
  });

  return server;
}

// ─── Redis stream consumer ────────────────────────────────────

interface NotifyEvent {
  messageId?: string;
  conversationId?: string;
  conversationName?: string;
  senderId?: string;
  senderName?: string;
  recipientId: string;
  contentPreview?: string;
  title?: string;
  body?: string;
  type?: string;
  questionId?: string;
}

function parseFields(fields: string[]): Record<string, string> {
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) data[fields[i]] = fields[i + 1];
  return data;
}

async function processMsgNotify(
  redis: Redis,
  entryId: string,
  fields: string[],
  stream: string
): Promise<void> {
  const data = parseFields(fields) as NotifyEvent & Record<string, string>;

  try {
    const recipientId = data.recipientId;
    if (!recipientId) { await redis.xack(stream, GROUP, entryId); return; }

    const tokens = await getDeviceTokens(recipientId);
    if (tokens.length > 0) {
      let title = data.title ?? data.conversationName ?? data.senderName ?? "New message";
      let body  = data.body  ?? data.contentPreview ?? "You have a new message";
      const notifData: Record<string, string> = {};
      if (data.conversationId) notifData.conversationId = data.conversationId;
      if (data.questionId)     notifData.questionId     = data.questionId;
      notifData.type = data.type ?? "message";

      await sendPush(tokens, title, body, notifData);
      console.log(`[notif-svc] Sent push to ${tokens.length} device(s) for user ${recipientId}`);
    }

    await redis.xack(stream, GROUP, entryId);
  } catch (err) {
    console.error("[notif-svc] Failed to process notification, will retry:", err);
  }
}

async function ensureGroup(redis: Redis, stream: string): Promise<void> {
  try {
    await redis.xgroup("CREATE", stream, GROUP, "0", "MKSTREAM");
  } catch (err: unknown) {
    if (!(err instanceof Error) || !err.message.includes("BUSYGROUP")) throw err;
  }
}

// Reclaim entries left pending by a consumer that died mid-processing
// (e.g. this process crashed before XACK). Each restart uses a fresh
// CONSUMER name, so without this sweep those entries would be orphaned
// in the group's pending-entries list forever.
async function claimStaleEntries(redis: Redis, stream: string): Promise<void> {
  try {
    const result = await redis.xautoclaim(
      stream, GROUP, CONSUMER, STALE_ENTRY_CLAIM_MS, "0-0", "COUNT", "50"
    ) as any;
    const claimed: any[] = result?.[1] ?? [];
    if (claimed.length > 0) {
      console.log(`[notif-svc] Claimed ${claimed.length} stale entries on ${stream}`);
      for (const [entryId, fields] of claimed) {
        await processMsgNotify(redis, entryId, fields, stream);
      }
    }
  } catch (err) {
    console.error(`[notif-svc] XAUTOCLAIM failed for ${stream}:`, err);
  }
}

async function main(): Promise<void> {
  console.log(`[notif-svc] Starting (consumer: ${CONSUMER})`);

  // PostgreSQL connection
  pool = new Pool({ connectionString: DATABASE_URL });
  pool.on("error", (err) => console.error("[notif-svc] Postgres pool error:", err));
  await pool.query("SELECT 1");
  console.log("[notif-svc] PostgreSQL connected");

  // Redis connection
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (isShuttingDown ? null : Math.min(times * 200, 5000)),
  });
  redis.on("error", (err) => console.error("[notif-svc] Redis client error:", err));
  redisClient = redis;

  await ensureGroup(redis, STREAM);
  await ensureGroup(redis, F_STREAM);

  // Reclaim any entries orphaned by a previous crashed process, then
  // keep sweeping periodically in case this process itself dies mid-entry.
  await claimStaleEntries(redis, STREAM);
  await claimStaleEntries(redis, F_STREAM);
  const claimInterval = setInterval(() => {
    claimStaleEntries(redis, STREAM).catch(() => {});
    claimStaleEntries(redis, F_STREAM).catch(() => {});
  }, CLAIM_SWEEP_INTERVAL_MS);

  const receiptInterval = setInterval(() => {
    checkPushReceipts().catch((err) => console.error("[notif-svc] Receipt sweep error:", err));
  }, RECEIPT_SWEEP_INTERVAL_MS);

  const httpServer = startHttpServer();

  // Consumer loop — reads from both msg:notify and forum:notify streams
  while (!isShuttingDown) {
    try {
      const results = await redis.xreadgroup(
        "GROUP", GROUP, CONSUMER,
        "COUNT", "20",
        "BLOCK", "5000",
        "STREAMS", STREAM, F_STREAM, ">", ">"
      ) as [string, [string, string[]][]][] | null;

      if (!results) continue;

      for (const [stream, entries] of results) {
        for (const [entryId, fields] of entries) {
          await processMsgNotify(redis, entryId, fields, stream);
        }
      }
    } catch (err) {
      if (isShuttingDown) break;
      console.error("[notif-svc] Consumer loop error:", err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  clearInterval(claimInterval);
  clearInterval(receiptInterval);
  httpServer.close();
  await redis.quit();
  await pool.end();
  console.log("[notif-svc] Shut down cleanly");
}

process.on("SIGTERM", () => { isShuttingDown = true; });
process.on("SIGINT",  () => { isShuttingDown = true; });

main().catch((err) => {
  console.error("[notif-svc] Fatal error:", err);
  process.exit(1);
});

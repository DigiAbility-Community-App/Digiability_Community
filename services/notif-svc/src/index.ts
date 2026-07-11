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

const expo = new Expo();
let pool: Pool;
let isShuttingDown = false;

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
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("[notif-svc] Push send error:", err);
    }
  }
}

// ─── HTTP server — /internal/notify for forum-svc ────────────

interface NotifyRequest {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

function startHttpServer(): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "notif-svc" }));
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

async function main(): Promise<void> {
  console.log(`[notif-svc] Starting (consumer: ${CONSUMER})`);

  // PostgreSQL connection
  pool = new Pool({ connectionString: DATABASE_URL });
  await pool.query("SELECT 1");
  console.log("[notif-svc] PostgreSQL connected");

  // Redis connection
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (isShuttingDown ? null : Math.min(times * 200, 5000)),
  });

  await ensureGroup(redis, STREAM);
  await ensureGroup(redis, F_STREAM);

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

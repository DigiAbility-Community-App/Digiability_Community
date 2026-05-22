// ─────────────────────────────────────────────────────────────
// notif-svc — Notification Service
//
// Standalone worker that consumes the msg:notify Redis Stream
// and sends push notifications + email alerts to offline users.
//
// This is NEVER on the critical send path. If notif-svc is down,
// messages are still delivered when the user comes back online.
// Notifications are a best-effort UX enhancement.
//
// Stream: msg:notify (published by delivery-worker when recipient is offline)
// Consumer Group: notif-svc-group
//
// Supported channels:
// - Push notifications (Firebase/APNs — placeholder)
// - Email alerts (via nodemailer)
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";
const STREAM = "msg:notify";
const GROUP = "notif-svc-group";
const CONSUMER = `notif-${process.pid}`;

let isShuttingDown = false;

interface NotifyEvent {
  messageId: string;
  conversationId: string;
  conversationName?: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  contentPreview: string;
  type: string;
  createdAt: string;
}

async function main(): Promise<void> {
  console.log(`[notif-svc] Starting (consumer: ${CONSUMER})`);

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (isShuttingDown) return null;
      return Math.min(times * 200, 5000);
    },
  });

  // Ensure consumer group exists
  try {
    await redis.xgroup("CREATE", STREAM, GROUP, "0", "MKSTREAM");
    console.log(`[notif-svc] Created consumer group ${GROUP}`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("BUSYGROUP")) {
      console.log(`[notif-svc] Consumer group ${GROUP} already exists`);
    } else {
      throw err;
    }
  }

  // Main consumer loop
  while (!isShuttingDown) {
    try {
      const results = await redis.xreadgroup(
        "GROUP", GROUP, CONSUMER,
        "COUNT", "20",
        "BLOCK", "5000",
        "STREAMS", STREAM, ">"
      );

      if (!results || results.length === 0) continue;

      for (const [, entries] of results) {
        for (const [entryId, fields] of entries) {
          await processNotification(redis, entryId, fields);
        }
      }
    } catch (err) {
      if (isShuttingDown) break;
      console.error("[notif-svc] Consumer loop error:", err);
      await sleep(2000);
    }
  }

  await redis.quit();
  console.log("[notif-svc] Shut down cleanly");
}

async function processNotification(
  redis: Redis,
  entryId: string,
  fields: string[]
): Promise<void> {
  // Parse flat key-value array
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1];
  }

  const event: NotifyEvent = {
    messageId: data.messageId,
    conversationId: data.conversationId,
    conversationName: data.conversationName || undefined,
    senderId: data.senderId,
    senderName: data.senderName || undefined,
    recipientId: data.recipientId,
    contentPreview: data.contentPreview,
    type: data.type,
    createdAt: data.createdAt,
  };

  try {
    // ── Push notification (placeholder) ──
    // In production: integrate with Firebase Cloud Messaging (FCM) or APNs
    console.log(`[notif-svc] Push notification for user ${event.recipientId}:`, {
      title: event.senderName ?? event.senderId,
      body: event.contentPreview,
      conversationId: event.conversationId,
    });

    // ── Email notification (conditional) ──
    // Only send email if user has email notifications enabled
    // and hasn't been notified recently (debounce)
    // await sendEmailNotification(event);

    // XACK — mark as processed
    await redis.xack(STREAM, GROUP, entryId);

    console.log(`[notif-svc] Notification processed for message ${event.messageId}`);
  } catch (err) {
    // Do NOT XACK — will retry
    console.error(`[notif-svc] Failed to process notification:`, err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graceful shutdown
process.on("SIGTERM", () => { isShuttingDown = true; });
process.on("SIGINT", () => { isShuttingDown = true; });

main().catch((err) => {
  console.error("[notif-svc] Fatal error:", err);
  process.exit(1);
});

// ─────────────────────────────────────────────────────────────
// Delivery Worker
//
// Standalone consumer process that reads from the msg:persisted
// Redis Stream and routes messages to recipient devices.
//
// Flow for each MESSAGE_PERSISTED event:
// 1. Get all conversation members (excluding sender)
// 2. For each recipient:
//    a. Look up active sessions in Redis registry
//    b. If sessions exist → publish delivery via Pub/Sub to target server(s)
//    c. If no sessions → mark as offline → emit to msg:notify stream
// 3. XACK the stream entry
//
// The delivery worker does NOT directly send WebSocket messages.
// It publishes Pub/Sub events that the target ChatSvc instance's
// DeliveryService picks up and forwards to local connections.
//
// Failure modes:
// - Redis registry lookup fails: log error, skip recipient (message stays PENDING)
// - Pub/Sub publish fails: log error, skip (recipient gets message on reconnect sync)
// - Worker crash: entry stays pending, re-processed after XCLAIM
//
// Run: node dist/workers/delivery.worker.js
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";
import { logger } from "../config/logger";
import { messageRepository } from "../repositories/message.repository";
import { publishMessageNotify } from "../streams/producer";
import { ensureConsumerGroups } from "../streams/producer";
import {
  STREAMS,
  CONSUMER_GROUPS,
  STREAM_READ_COUNT,
  STREAM_BLOCK_MS,
  REGISTRY_KEYS,
  PUBSUB_CHANNELS,
} from "../streams/constants";
import { MessagePersistedEvent, DeliveryPayload, MessageNotifyEvent } from "../types/message.types";
import { SessionInfo } from "../types/common.types";
import prisma from "../models/prisma.client";

const CONSUMER_NAME = `delivery-${process.pid}`;
const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";

let isShuttingDown = false;

async function main(): Promise<void> {
  logger.info(`Delivery worker starting (consumer: ${CONSUMER_NAME})`);

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (isShuttingDown) return null;
      return Math.min(times * 200, 5000);
    },
  });

  await prisma.$connect();
  logger.info("Database connected");

  await ensureConsumerGroups();
  logger.info("Consumer groups verified");

  // Claim stale entries on startup
  await claimStaleEntries(redis);

  // Main consumer loop
  while (!isShuttingDown) {
    try {
      await consumeBatch(redis);
    } catch (err) {
      if (isShuttingDown) break;
      logger.error("Delivery consumer loop error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      await sleep(2000);
    }
  }

  await redis.quit();
  await prisma.$disconnect();
  logger.info("Delivery worker shut down cleanly");
}

async function consumeBatch(redis: Redis): Promise<void> {
  const results = await redis.xreadgroup(
    "GROUP",
    CONSUMER_GROUPS.DELIVERY_WORKER,
    CONSUMER_NAME,
    "COUNT",
    String(STREAM_READ_COUNT),
    "BLOCK",
    String(STREAM_BLOCK_MS),
    "STREAMS",
    STREAMS.MESSAGE_PERSISTED,
    ">"
  );

  if (!results || results.length === 0) return;

  // ioredis XREADGROUP returns: [streamName, [[entryId, fields], ...]][]
  const streamResults = results as [string, [string, string[]][]][];
  for (const [, entries] of streamResults) {
    for (const [entryId, fields] of entries) {
      await processEntry(redis, entryId, fields);
    }
  }
}

async function processEntry(
  redis: Redis,
  entryId: string,
  fields: string[]
): Promise<void> {
  // Parse flat key-value array into object
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    data[fields[i]] = fields[i + 1];
  }

  const event: MessagePersistedEvent = {
    messageId: data.messageId,
    conversationId: data.conversationId,
    senderId: data.senderId,
    clientMessageId: data.clientMessageId,
    content: data.content,
    type: data.type,
    metadata: data.metadata || undefined,
    sequenceNo: data.sequenceNo,
    createdAt: data.createdAt,
  };

  logger.debug("Processing MESSAGE_PERSISTED", {
    messageId: event.messageId,
    conversationId: event.conversationId,
  });
  console.log('[TRACE] 📨 delivery: Processing MESSAGE_PERSISTED', event.messageId);

  try {
    // ── 1. Get all conversation members (excluding sender) ──
    const memberIds = await messageRepository.getConversationMemberIds(event.conversationId);
    const recipientIds = memberIds.filter((id) => id !== event.senderId);

    if (recipientIds.length === 0) {
      // No recipients (sender-only conversation?) — just ACK
      await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, entryId);
      return;
    }

    // ── 2. Build delivery payload ──
    const deliveryPayload: Omit<DeliveryPayload, "targetUserId"> = {
      message: {
        messageId: event.messageId,
        clientMessageId: event.clientMessageId,
        conversationId: event.conversationId,
        senderId: event.senderId,
        content: event.content,
        type: event.type,
        metadata: event.metadata,
        sequenceNo: event.sequenceNo,
        createdAt: event.createdAt,
      },
    };

    // ── 3. Route to each recipient ──
    // Group by target server to minimize Pub/Sub messages
    const serverDeliveries = new Map<string, DeliveryPayload[]>();
    const offlineRecipients: string[] = [];

    for (const recipientId of recipientIds) {
      const sessions = await getRecipientSessions(redis, recipientId);

      if (sessions.length === 0) {
        // Recipient is offline
        offlineRecipients.push(recipientId);
        console.log('[TRACE] 📴 delivery: Recipient OFFLINE (no sessions)', recipientId);
        continue;
      }

      console.log('[TRACE] 🟢 delivery: Recipient ONLINE, sessions:', sessions.length, 'userId:', recipientId);

      // Recipient has active sessions — group by serverId
      const serverIds = new Set(sessions.map((s) => s.serverId));
      for (const serverId of serverIds) {
        const payload: DeliveryPayload = {
          targetUserId: recipientId,
          ...deliveryPayload,
        };

        if (!serverDeliveries.has(serverId)) {
          serverDeliveries.set(serverId, []);
        }
        serverDeliveries.get(serverId)!.push(payload);
      }
    }

    // ── 4. Publish to target servers via Pub/Sub ──
    for (const [serverId, payloads] of serverDeliveries) {
      for (const payload of payloads) {
        try {
          await redis.publish(
            PUBSUB_CHANNELS.SERVER_DELIVER(serverId),
            JSON.stringify(payload)
          );
        } catch (err) {
          // Pub/Sub failure is non-fatal: message is in DB, recipient
          // will get it on reconnect sync.
          logger.warn("Pub/Sub delivery failed", {
            messageId: event.messageId,
            userId: payload.targetUserId,
            serverId,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      }
    }

    // ── 5. Handle offline recipients ──
    for (const recipientId of offlineRecipients) {
      const notifyEvent: MessageNotifyEvent = {
        messageId: event.messageId,
        conversationId: event.conversationId,
        senderId: event.senderId,
        recipientId,
        contentPreview: event.content.substring(0, 100),
        type: event.type,
        createdAt: event.createdAt,
      };

      try {
        await publishMessageNotify(notifyEvent);
      } catch (err) {
        // Notification failure is non-fatal
        logger.warn("Notify publish failed", {
          messageId: event.messageId,
          userId: recipientId,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    // NOTE: Sender echo removed. The sender's originating device has the
    // message via optimistic add + message.ack. Sender's OTHER devices on
    // the same server receive the echo from message.handler.ts via
    // sendToUserExcept. This block was causing duplicate messages on the
    // sender's device by re-delivering via Pub/Sub to ALL sender sessions.

    // ── 7. XACK ──
    await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, entryId);

    logger.info("Delivery routing completed", {
      messageId: event.messageId,
      conversationId: event.conversationId,
      onlineRecipients: String(recipientIds.length - offlineRecipients.length),
      offlineRecipients: String(offlineRecipients.length),
      serverCount: String(serverDeliveries.size),
    });
    console.log('[TRACE] ✅ delivery: Routing complete', {
      messageId: event.messageId,
      online: recipientIds.length - offlineRecipients.length,
      offline: offlineRecipients.length,
    });
  } catch (err) {
    logger.error("Delivery processing failed — will retry", {
      messageId: event.messageId,
      conversationId: event.conversationId,
      error: err instanceof Error ? err.message : "unknown",
    });
    // Do NOT XACK — entry stays pending for retry
  }
}

/**
 * Look up active sessions for a recipient in Redis registry.
 */
async function getRecipientSessions(redis: Redis, userId: string): Promise<SessionInfo[]> {
  const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
  const entries = await redis.hgetall(userKey);

  const sessions: SessionInfo[] = [];
  for (const [, value] of Object.entries(entries)) {
    try {
      sessions.push(JSON.parse(value) as SessionInfo);
    } catch {
      // Corrupted entry — skip
    }
  }

  return sessions;
}

async function claimStaleEntries(redis: Redis): Promise<void> {
  try {
    const result = await redis.xautoclaim(
      STREAMS.MESSAGE_PERSISTED,
      CONSUMER_GROUPS.DELIVERY_WORKER,
      CONSUMER_NAME,
      60000,
      "0-0",
      "COUNT",
      "50"
    );

    if (result && result[1] && (result[1] as any[]).length > 0) {
      const claimed = (result[1] as any[]).length;
      logger.info(`Claimed ${claimed} stale delivery entries`);

      for (const entry of result[1] as any[]) {
        const [entryId, fields] = entry;
        await processEntry(redis, entryId, fields);
      }
    }
  } catch (err) {
    logger.warn("XAUTOCLAIM failed for delivery worker", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Graceful Shutdown ──────────────────────────────────────

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down delivery worker");
  isShuttingDown = true;
});

process.on("SIGINT", () => {
  logger.info("SIGINT received — shutting down delivery worker");
  isShuttingDown = true;
});

main().catch((err) => {
  logger.error("Delivery worker fatal error", {
    error: err instanceof Error ? err.message : "unknown",
  });
  process.exit(1);
});

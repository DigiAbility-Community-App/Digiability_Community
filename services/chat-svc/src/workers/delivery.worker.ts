// ─────────────────────────────────────────────────────────────
// Delivery Worker
//
// Reads from msg:persisted Redis Stream and routes messages
// to recipient devices via Pub/Sub or msg:notify stream.
//
// Can run standalone (node dist/workers/delivery.worker.js)
// or embedded inside chat-svc via startDeliveryWorker().
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";
import { logger } from "../config/logger";
import { conversationRepository } from "../repositories/conversation.repository";
import { publishMessageNotify, ensureConsumerGroups } from "../streams/producer";
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

const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Start the delivery consumer loop.
 * Returns a stop() function for graceful shutdown.
 */
export async function startDeliveryWorker(): Promise<() => Promise<void>> {
  const consumerId = `delivery-${process.pid}`;
  let running = true;

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (running ? Math.min(times * 200, 5000) : null),
  });

  await ensureConsumerGroups();
  logger.info("Delivery worker started", { consumerId });

  claimStaleEntries(redis, consumerId).catch(() => {});

  const loop = (async () => {
    while (running) {
      try {
        const results = await redis.xreadgroup(
          "GROUP", CONSUMER_GROUPS.DELIVERY_WORKER, consumerId,
          "COUNT", String(STREAM_READ_COUNT),
          "BLOCK", String(STREAM_BLOCK_MS),
          "STREAMS", STREAMS.MESSAGE_PERSISTED, ">"
        );

        if (!results) continue;

        const streamResults = results as [string, [string, string[]][]][];
        for (const [, entries] of streamResults) {
          for (const [entryId, fields] of entries) {
            await processEntry(redis, entryId, fields);
          }
        }
      } catch (err) {
        if (!running) break;
        logger.error("Delivery consumer loop error", {
          error: err instanceof Error ? err.message : "unknown",
        });
        await sleep(2000);
      }
    }
  })();

  return async () => {
    running = false;
    await loop.catch(() => {});
    await redis.quit().catch(() => {});
    logger.info("Delivery worker stopped");
  };
}

async function processEntry(redis: Redis, entryId: string, fields: string[]): Promise<void> {
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) data[fields[i]] = fields[i + 1];

  const event: MessagePersistedEvent = {
    messageId: data.messageId,
    conversationId: data.conversationId,
    senderId: data.senderId,
    senderName: data.senderName || undefined,
    clientMessageId: data.clientMessageId,
    content: data.content,
    type: data.type,
    metadata: data.metadata || undefined,
    sequenceNo: data.sequenceNo,
    createdAt: data.createdAt,
  };

  logger.debug("Processing MESSAGE_PERSISTED", { messageId: event.messageId });

  try {
    const conversation = await conversationRepository.getById(event.conversationId);
    if (!conversation) {
      await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, entryId);
      return;
    }

    const recipientIds = conversation.members
      .filter((m) => m.userId !== event.senderId)
      .map((m) => m.userId);
    const mutedIds = new Set(
      conversation.members.filter((m) => m.isMuted).map((m) => m.userId)
    );
    // Only groups have a display name; DMs fall through to senderName
    // in notif-svc's title-selection chain.
    const conversationName = conversation.type !== "DIRECT" ? conversation.name ?? undefined : undefined;

    if (recipientIds.length === 0) {
      await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, entryId);
      return;
    }

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

    const serverDeliveries = new Map<string, DeliveryPayload[]>();
    const offlineRecipients: string[] = [];

    for (const recipientId of recipientIds) {
      const sessions = await getRecipientSessions(redis, recipientId);
      if (sessions.length === 0) {
        if (!mutedIds.has(recipientId)) offlineRecipients.push(recipientId);
        continue;
      }
      const serverIds = new Set(sessions.map((s) => s.serverId));
      for (const serverId of serverIds) {
        const payload: DeliveryPayload = { targetUserId: recipientId, ...deliveryPayload };
        if (!serverDeliveries.has(serverId)) serverDeliveries.set(serverId, []);
        serverDeliveries.get(serverId)!.push(payload);
      }
    }

    for (const [serverId, payloads] of serverDeliveries) {
      for (const payload of payloads) {
        try {
          await redis.publish(PUBSUB_CHANNELS.SERVER_DELIVER(serverId), JSON.stringify(payload));
        } catch (err) {
          logger.warn("Pub/Sub delivery failed", {
            messageId: event.messageId, serverId,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      }
    }

    for (const recipientId of offlineRecipients) {
      const notifyEvent: MessageNotifyEvent = {
        messageId: event.messageId,
        conversationId: event.conversationId,
        conversationName,
        senderId: event.senderId,
        senderName: event.senderName,
        recipientId,
        contentPreview: event.content.substring(0, 100),
        type: event.type,
        createdAt: event.createdAt,
      };
      try {
        await publishMessageNotify(notifyEvent);
      } catch {
        logger.warn("Notify publish failed", { messageId: event.messageId, userId: recipientId });
      }
    }

    await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, entryId);

    logger.info("Delivery routing completed", {
      messageId: event.messageId,
      online: String(recipientIds.length - offlineRecipients.length),
      offline: String(offlineRecipients.length),
    });
  } catch (err) {
    logger.error("Delivery processing failed — will retry", {
      messageId: event.messageId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

async function getRecipientSessions(redis: Redis, userId: string): Promise<SessionInfo[]> {
  const entries = await redis.hgetall(REGISTRY_KEYS.USER_SESSIONS(userId));
  const sessions: SessionInfo[] = [];
  for (const value of Object.values(entries)) {
    try { sessions.push(JSON.parse(value) as SessionInfo); } catch {}
  }
  return sessions;
}

async function claimStaleEntries(redis: Redis, consumerId: string): Promise<void> {
  try {
    const result = await redis.xautoclaim(
      STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER, consumerId,
      60000, "0-0", "COUNT", "50"
    ) as any;
    const claimed: any[] = result?.[1] ?? [];
    if (claimed.length > 0) {
      logger.info(`Claimed ${claimed.length} stale delivery entries`);
      for (const entry of claimed) {
        await processEntry(redis, entry[0], entry[1]);
      }
    }
  } catch {
    logger.warn("XAUTOCLAIM unavailable for delivery worker");
  }
}

// ── Standalone mode (node dist/workers/delivery.worker.js) ───
if (require.main === module) {
  startDeliveryWorker().then((stop) => {
    process.on("SIGTERM", () => stop().then(() => process.exit(0)));
    process.on("SIGINT",  () => stop().then(() => process.exit(0)));
  }).catch((err) => {
    logger.error("Delivery worker fatal error", { error: err.message });
    process.exit(1);
  });
}

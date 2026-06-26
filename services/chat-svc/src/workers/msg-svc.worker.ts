// ─────────────────────────────────────────────────────────────
// Message Service Worker (msg-svc)
//
// Reads from msg:created Redis Stream and persists messages
// to PostgreSQL (idempotent via clientMessageId UNIQUE).
//
// Can run standalone (node dist/workers/msg-svc.worker.js)
// or embedded inside chat-svc via startMsgWorker().
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";
import { logger } from "../config/logger";
import { messageRepository } from "../repositories/message.repository";
import { publishMessagePersisted, ensureConsumerGroups } from "../streams/producer";
import {
  STREAMS,
  CONSUMER_GROUPS,
  STREAM_READ_COUNT,
  STREAM_BLOCK_MS,
} from "../streams/constants";
import { MessageCreatedEvent } from "../types/message.types";

const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Start the msg-svc consumer loop.
 * Returns a stop() function for graceful shutdown.
 */
export async function startMsgWorker(): Promise<() => Promise<void>> {
  const consumerId = `msg-svc-${process.pid}`;
  let running = true;

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => (running ? Math.min(times * 200, 5000) : null),
  });

  await ensureConsumerGroups();
  logger.info("msg-svc worker started", { consumerId });

  // Claim any stale pending entries from crashed consumers
  claimStaleEntries(redis, consumerId).catch(() => {});

  // Background consumer loop
  const loop = (async () => {
    while (running) {
      try {
        const results = await redis.xreadgroup(
          "GROUP", CONSUMER_GROUPS.MSG_SVC, consumerId,
          "COUNT", String(STREAM_READ_COUNT),
          "BLOCK", String(STREAM_BLOCK_MS),
          "STREAMS", STREAMS.MESSAGE_CREATED, ">"
        );

        if (!results) continue;

        const streamResults = results as [string, [string, string[]][]][];
        for (const [, entries] of streamResults) {
          for (const [entryId, fields] of entries) {
            await processEntry(redis, entryId, fields, consumerId);
          }
        }
      } catch (err) {
        if (!running) break;
        logger.error("msg-svc consumer loop error", {
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
    logger.info("msg-svc worker stopped");
  };
}

async function processEntry(
  redis: Redis,
  entryId: string,
  fields: string[],
  consumerId: string
): Promise<void> {
  const data: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) data[fields[i]] = fields[i + 1];

  const event: MessageCreatedEvent = {
    messageId: data.messageId,
    conversationId: data.conversationId,
    senderId: data.senderId,
    clientMessageId: data.clientMessageId,
    content: data.content,
    type: data.type,
    metadata: data.metadata || undefined,
    createdAt: data.createdAt,
  };

  logger.debug("Processing MESSAGE_CREATED", {
    messageId: event.messageId,
    clientMessageId: event.clientMessageId,
  });

  try {
    const persisted = await messageRepository.persistMessage({
      messageId: event.messageId,
      conversationId: event.conversationId,
      senderId: event.senderId,
      clientMessageId: event.clientMessageId,
      content: event.content,
      type: event.type,
      metadata: event.metadata,
      createdAt: event.createdAt,
    });

    await publishMessagePersisted({
      messageId: persisted.id,
      conversationId: persisted.conversationId,
      senderId: persisted.senderId,
      clientMessageId: persisted.clientMessageId,
      content: persisted.content,
      type: persisted.type,
      metadata: event.metadata,
      sequenceNo: persisted.sequenceNo.toString(),
      createdAt: persisted.createdAt.toISOString(),
    });

    await redis.xack(STREAMS.MESSAGE_CREATED, CONSUMER_GROUPS.MSG_SVC, entryId);

    logger.info("Message persisted and ACKed", {
      messageId: persisted.id,
      sequenceNo: persisted.sequenceNo.toString(),
      wasNew: String(persisted.isNew),
    });
  } catch (err) {
    logger.error("Failed to persist message — will retry", {
      messageId: event.messageId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

async function claimStaleEntries(redis: Redis, consumerId: string): Promise<void> {
  try {
    const result = await redis.xautoclaim(
      STREAMS.MESSAGE_CREATED, CONSUMER_GROUPS.MSG_SVC, consumerId,
      60000, "0-0", "COUNT", "50"
    ) as any;
    const claimed: any[] = result?.[1] ?? [];
    if (claimed.length > 0) {
      logger.info(`Claimed ${claimed.length} stale entries`);
      for (const entry of claimed) {
        const [entryId, fields] = entry;
        await processEntry(redis, entryId, fields, consumerId);
      }
    }
  } catch {
    logger.warn("XAUTOCLAIM unavailable — stale entries handled on next restart");
  }
}

// ── Standalone mode (node dist/workers/msg-svc.worker.js) ────
if (require.main === module) {
  startMsgWorker().then((stop) => {
    process.on("SIGTERM", () => stop().then(() => process.exit(0)));
    process.on("SIGINT",  () => stop().then(() => process.exit(0)));
  }).catch((err) => {
    logger.error("msg-svc fatal error", { error: err.message });
    process.exit(1);
  });
}

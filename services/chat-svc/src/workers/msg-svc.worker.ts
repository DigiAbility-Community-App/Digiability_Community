// ─────────────────────────────────────────────────────────────
// Message Service Worker (msg-svc)
//
// Standalone consumer process that reads from the msg:created
// Redis Stream and persists messages to PostgreSQL.
//
// Key guarantees:
// 1. IDEMPOTENT: Uses clientMessageId UNIQUE constraint + upsert.
//    Processing the same event twice will NOT create duplicates.
//
// 2. AT-LEAST-ONCE: Only XACKs after successful DB commit.
//    If the worker crashes before XACK, the event is re-delivered
//    to another consumer in the group (or this one on restart).
//
// 3. ORDERED: Messages within a conversation get a monotonically
//    increasing sequenceNo assigned in a serializable transaction.
//
// Failure modes:
// - DB down: events pile up in pending list, re-attempted on recovery
// - Redis down: process exits, supervisor restarts it
// - Worker crash: pending events claimed by other consumers via XCLAIM
//
// Run: node dist/workers/msg-svc.worker.js
//      or: npx ts-node-dev src/workers/msg-svc.worker.ts
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";
import { logger } from "../config/logger";
import { messageRepository } from "../repositories/message.repository";
import { publishMessagePersisted } from "../streams/producer";
import { ensureConsumerGroups } from "../streams/producer";
import {
  STREAMS,
  CONSUMER_GROUPS,
  STREAM_READ_COUNT,
  STREAM_BLOCK_MS,
} from "../streams/constants";
import { MessageCreatedEvent } from "../types/message.types";
import prisma from "../models/prisma.client";
import { connectCassandra, disconnectCassandra } from "../config/cassandra";

const CONSUMER_NAME = `msg-svc-${process.pid}`;
const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";

let isShuttingDown = false;

async function main(): Promise<void> {
  logger.info(`msg-svc worker starting (consumer: ${CONSUMER_NAME})`);

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (isShuttingDown) return null;  // Don't retry during shutdown
      return Math.min(times * 200, 5000);
    },
  });

  // Verify DB connectivity
  await prisma.$connect();
  logger.info("PostgreSQL connected");

  // Connect to Cassandra (message store)
  await connectCassandra();

  // Ensure consumer group exists
  await ensureConsumerGroups();
  logger.info("Consumer groups verified");

  // Claim any stale pending entries from dead consumers
  await claimStaleEntries(redis);

  // Main consumer loop
  while (!isShuttingDown) {
    try {
      await consumeBatch(redis);
    } catch (err) {
      if (isShuttingDown) break;
      logger.error("Consumer loop error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      // Brief pause before retrying to avoid tight error loops
      await sleep(2000);
    }
  }

  // Cleanup
  await redis.quit();
  await prisma.$disconnect();
  await disconnectCassandra();
  logger.info("msg-svc worker shut down cleanly");
}

/**
 * Read and process a batch of events from the stream.
 */
async function consumeBatch(redis: Redis): Promise<void> {
  // XREADGROUP: read new messages for our consumer group
  // ">" means "give me only new, undelivered messages"
  const results = await redis.xreadgroup(
    "GROUP",
    CONSUMER_GROUPS.MSG_SVC,
    CONSUMER_NAME,
    "COUNT",
    String(STREAM_READ_COUNT),
    "BLOCK",
    String(STREAM_BLOCK_MS),
    "STREAMS",
    STREAMS.MESSAGE_CREATED,
    ">"
  );

  if (!results || results.length === 0) return;

  console.log('[TRACE] 📨 msg-svc: Got', results.length, 'stream results to process');

  // ioredis XREADGROUP returns: [streamName, [[entryId, fields], ...]][]
  const streamResults = results as [string, [string, string[]][]][];
  for (const [, entries] of streamResults) {
    for (const [entryId, fields] of entries) {
      await processEntry(redis, entryId, fields);
    }
  }
}

/**
 * Process a single stream entry.
 * On success: persist to DB → emit MESSAGE_PERSISTED → XACK.
 * On failure: do NOT XACK → entry stays pending for retry.
 */
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

  console.log('[TRACE] 🔧 msg-svc: Processing MESSAGE_CREATED', {
    messageId: event.messageId,
    conversationId: event.conversationId,
  });

  logger.debug("Processing MESSAGE_CREATED", {
    messageId: event.messageId,
    clientMessageId: event.clientMessageId,
    conversationId: event.conversationId,
  });

  try {
    // ── Persist to PostgreSQL (idempotent via clientMessageId UNIQUE) ──
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

    // ── Emit MESSAGE_PERSISTED to downstream consumers ──
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

    // ── XACK: mark as successfully processed ──
    // Only after DB commit AND downstream publish succeed.
    // If this XACK fails, the entry stays pending — but since
    // persistence is idempotent, re-processing is safe.
    await redis.xack(STREAMS.MESSAGE_CREATED, CONSUMER_GROUPS.MSG_SVC, entryId);

    console.log('[TRACE] ✅ msg-svc: Message persisted and published to msg:persisted', {
      messageId: persisted.id,
      sequenceNo: persisted.sequenceNo.toString(),
    });

    logger.info("Message persisted and ACKed", {
      messageId: persisted.id,
      clientMessageId: persisted.clientMessageId,
      conversationId: persisted.conversationId,
      sequenceNo: persisted.sequenceNo.toString(),
      wasNew: String(persisted.isNew),
    });
  } catch (err) {
    // Do NOT XACK — event stays pending and will be retried.
    // This could be a transient DB error, serialization conflict, etc.
    logger.error("Failed to persist message — will retry", {
      messageId: event.messageId,
      clientMessageId: event.clientMessageId,
      conversationId: event.conversationId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Claim stale pending entries from dead/crashed consumers.
 * If an entry has been pending for > 60s without XACK, we claim it
 * and re-process it. This handles edge case #5 (worker crash before XACK).
 */
async function claimStaleEntries(redis: Redis): Promise<void> {
  try {
    // XAUTOCLAIM: claim entries idle for > 60 seconds
    const result = await redis.xautoclaim(
      STREAMS.MESSAGE_CREATED,
      CONSUMER_GROUPS.MSG_SVC,
      CONSUMER_NAME,
      60000,  // min-idle-time: 60 seconds
      "0-0",  // start from beginning of PEL
      "COUNT",
      "50"
    );

    if (result && result[1] && (result[1] as any[]).length > 0) {
      const claimed = (result[1] as any[]).length;
      logger.info(`Claimed ${claimed} stale pending entries`);

      // Process claimed entries
      for (const entry of result[1] as any[]) {
        const [entryId, fields] = entry;
        await processEntry(redis, entryId, fields);
      }
    }
  } catch (err) {
    // XAUTOCLAIM may not be available on older Redis versions
    logger.warn("XAUTOCLAIM failed — stale entries will be processed on restart", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Graceful Shutdown ──────────────────────────────────────

process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down msg-svc worker");
  isShuttingDown = true;
});

process.on("SIGINT", () => {
  logger.info("SIGINT received — shutting down msg-svc worker");
  isShuttingDown = true;
});

// Start the worker
main().catch((err) => {
  logger.error("msg-svc worker fatal error", {
    error: err instanceof Error ? err.message : "unknown",
  });
  process.exit(1);
});

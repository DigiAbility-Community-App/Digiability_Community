// ─────────────────────────────────────────────────────────────
// Redis Stream Producer
// Helpers for writing events to Redis Streams with XADD.
// All producers use MAXLEN ~ for approximate stream trimming
// to prevent unbounded memory growth.
// ─────────────────────────────────────────────────────────────

import { redis } from "../config/redis";
import { logger } from "../config/logger";
import { STREAMS, STREAM_MAX_LEN, CONSUMER_GROUPS } from "./constants";
import { MessageCreatedEvent, MessagePersistedEvent, MessageNotifyEvent } from "../types/message.types";

/**
 * Write a flat key-value map to a Redis Stream.
 * Returns the stream entry ID (e.g., "1713780000000-0").
 */
async function xadd(
  stream: string,
  data: Record<string, string>
): Promise<string> {
  // Flatten object to alternating key-value array for XADD
  const fields: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      fields.push(key, String(value));
    }
  }

  // MAXLEN ~ provides approximate trimming (faster than exact)
  const entryId = await redis.xadd(
    stream,
    "MAXLEN",
    "~",
    String(STREAM_MAX_LEN),
    "*",   // Auto-generate entry ID
    ...fields
  ) as string;

  if (!entryId) {
    throw new Error(`XADD to ${stream} returned null — stream write failed`);
  }

  return entryId;
}

/**
 * Ensure consumer groups exist for all streams.
 * Called on startup. Safe to call repeatedly — ignores BUSYGROUP errors.
 */
export async function ensureConsumerGroups(): Promise<void> {
  const groupSetup: Array<[string, string]> = [
    [STREAMS.MESSAGE_CREATED, CONSUMER_GROUPS.MSG_SVC],
    [STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.DELIVERY_WORKER],
    [STREAMS.MESSAGE_NOTIFY, CONSUMER_GROUPS.NOTIF_SVC],
    [STREAMS.RECEIPT_EVENTS, CONSUMER_GROUPS.RECEIPT_PROCESSOR],
  ];

  for (const [stream, group] of groupSetup) {
    try {
      // MKSTREAM creates the stream if it doesn't exist
      // "0" means start reading from the beginning of the stream
      await redis.xgroup("CREATE", stream, group, "0", "MKSTREAM");
      logger.info(`Created consumer group ${group} on ${stream}`);
    } catch (err: unknown) {
      // BUSYGROUP means group already exists — safe to ignore
      if (err instanceof Error && err.message.includes("BUSYGROUP")) {
        logger.debug(`Consumer group ${group} already exists on ${stream}`);
      } else {
        throw err;
      }
    }
  }
}

// ─── Typed Producers ──────────────────────────────────────────

export async function publishMessageCreated(
  event: MessageCreatedEvent
): Promise<string> {
  const entryId = await xadd(STREAMS.MESSAGE_CREATED, {
    messageId: event.messageId,
    conversationId: event.conversationId,
    senderId: event.senderId,
    clientMessageId: event.clientMessageId,
    content: event.content,
    type: event.type,
    metadata: event.metadata ?? "",
    createdAt: event.createdAt,
  });

  logger.debug("Published MESSAGE_CREATED", {
    messageId: event.messageId,
    clientMessageId: event.clientMessageId,
    conversationId: event.conversationId,
  });

  return entryId;
}

export async function publishMessagePersisted(
  event: MessagePersistedEvent
): Promise<string> {
  const entryId = await xadd(STREAMS.MESSAGE_PERSISTED, {
    messageId: event.messageId,
    conversationId: event.conversationId,
    senderId: event.senderId,
    clientMessageId: event.clientMessageId,
    content: event.content,
    type: event.type,
    metadata: event.metadata ?? "",
    sequenceNo: event.sequenceNo,
    createdAt: event.createdAt,
  });

  logger.debug("Published MESSAGE_PERSISTED", {
    messageId: event.messageId,
    conversationId: event.conversationId,
  });

  return entryId;
}

export async function publishMessageNotify(
  event: MessageNotifyEvent
): Promise<string> {
  const entryId = await xadd(STREAMS.MESSAGE_NOTIFY, {
    messageId: event.messageId,
    conversationId: event.conversationId,
    conversationName: event.conversationName ?? "",
    senderId: event.senderId,
    senderName: event.senderName ?? "",
    recipientId: event.recipientId,
    contentPreview: event.contentPreview,
    type: event.type,
    createdAt: event.createdAt,
  });

  logger.debug("Published MESSAGE_NOTIFY", {
    messageId: event.messageId,
    userId: event.recipientId,
  });

  return entryId;
}

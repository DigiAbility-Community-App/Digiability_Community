// ─────────────────────────────────────────────────────────────
// Digiability Bot Worker
//
// Standalone consumer that listens for PERSISTED messages.
// If a message is sent to a conversation containing the bot,
// the bot processes the message and responds.
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import { ulid } from "ulid";
import { logger } from "../config/logger";
import { STREAMS, CONSUMER_GROUPS, STREAM_READ_COUNT, STREAM_BLOCK_MS } from "../streams/constants";
import { MessagePersistedEvent } from "../types/message.types";
import { publishMessageCreated, ensureConsumerGroups } from "../streams/producer";
import { conversationRepository } from "../repositories/conversation.repository";

const CONSUMER_NAME = `bot-worker-${process.pid}`;
const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";
const REDIS_URL = process.env.REDIS_URL ?? "redis://:redis_secret@localhost:6379";

let isShuttingDown = false;

async function main(): Promise<void> {
  logger.info(`🤖 Bot worker starting (consumer: ${CONSUMER_NAME})`);

  const redis = new Redis(REDIS_URL);

  // Ensure consumer groups exist
  await ensureConsumerGroups();

  while (!isShuttingDown) {
    try {
      const results = await redis.xreadgroup(
        "GROUP",
        CONSUMER_GROUPS.BOT_SERVICE,
        CONSUMER_NAME,
        "COUNT",
        String(STREAM_READ_COUNT),
        "BLOCK",
        String(STREAM_BLOCK_MS),
        "STREAMS",
        STREAMS.MESSAGE_PERSISTED,
        ">"
      );

      if (!results || results.length === 0) continue;

      const streamResults = results as [string, [string, string[]][]][];
      for (const [, entries] of streamResults) {
        for (const [entryId, fields] of entries) {
          await processEntry(redis, entryId, fields);
        }
      }
    } catch (err) {
      if (isShuttingDown) break;
      logger.error("Bot worker error", { error: err instanceof Error ? err.message : "unknown" });
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await redis.quit();
  logger.info("Bot worker shut down");
}

async function processEntry(redis: Redis, entryId: string, fields: string[]): Promise<void> {
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

  // 1. Don't respond to self
  if (event.senderId === BOT_USER_ID) {
    await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.BOT_SERVICE, entryId);
    return;
  }

  // 2. Check if bot is a member of this conversation
  const isMember = await conversationRepository.isMember(event.conversationId, BOT_USER_ID);
  if (!isMember) {
    await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.BOT_SERVICE, entryId);
    return;
  }

  logger.info("🤖 Bot received message", { conversationId: event.conversationId, senderId: event.senderId });

  // 3. Simple Logic: Echo back for now
  // In a real app, this would call an LLM or a rule engine.
  const replyContent = `Hello! I am the Digiability Bot. I received your message: "${event.content}". How can I help you today?`;

  await publishMessageCreated({
    messageId: uuidv4(),
    conversationId: event.conversationId,
    senderId: BOT_USER_ID,
    clientMessageId: `bot-${ulid()}`,
    content: replyContent,
    type: "TEXT",
    createdAt: new Date().toISOString(),
  });

  // 4. ACK the original message
  await redis.xack(STREAMS.MESSAGE_PERSISTED, CONSUMER_GROUPS.BOT_SERVICE, entryId);
}

main().catch(err => {
  logger.error("Bot worker fatal error", { error: err.message });
  process.exit(1);
});

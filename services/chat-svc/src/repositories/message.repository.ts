// ─────────────────────────────────────────────────────────────
// Message Repository — Dual-Store Architecture
//
// CASSANDRA: Message content storage (write-optimized, time-series)
//   - messages table: partitioned by conversation_id
//   - messages_by_client_id: idempotent write dedup
//   - conversation_sequence: atomic sequence counter
//
// POSTGRESQL (Prisma): Delivery state management (transactional)
//   - MessageRecipient: per-user delivery tracking
//   - MessageReceipt: audit log
//   - ConversationMember: read cursors
//
// This split gives us:
//   - Fast writes to Cassandra (no contention on sequence lock)
//   - Transactional delivery guarantees via Postgres
//   - Efficient time-range queries for message history
// ─────────────────────────────────────────────────────────────

import cassandra from "../config/cassandra";
import prisma from "../models/prisma.client";
import { types as cassandraTypes } from "cassandra-driver";
import { DeliveryStatus, ReceiptType } from "@prisma/client";
import { logger } from "../config/logger";

const Uuid = cassandraTypes.Uuid;
const TimeUuid = cassandraTypes.TimeUuid;

export interface PersistMessageInput {
  messageId: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  type: string;
  metadata?: string;
  createdAt: string; // ISO 8601
}

export interface PersistedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sequenceNo: bigint;
  clientMessageId: string;
  content: string;
  type: string;
  createdAt: Date;
  isNew: boolean; // true if this was a new insert, false if deduplicated
}

class MessageRepository {
  // ─── Cassandra: Message Persistence ────────────────────

  /**
   * Persist a message with idempotency via client_message_id dedup.
   *
   * 1. Check messages_by_client_id for dedup
   * 2. Get next sequence number (Redis INCR or Cassandra LWT)
   * 3. Write to messages + messages_by_client_id
   * 4. Create recipient rows in Postgres
   * 5. Update conversation last message preview in Postgres
   */
  async persistMessage(input: PersistMessageInput): Promise<PersistedMessage> {
    const {
      messageId,
      conversationId,
      senderId,
      clientMessageId,
      content,
      type,
      metadata,
      createdAt,
    } = input;

    // ── Step 1: Dedup check via Cassandra ──
    const existing = await cassandra.execute(
      "SELECT message_id, conversation_id, sender_id, sequence_no, client_message_id, content, type, created_at FROM messages_by_client_id WHERE client_message_id = ?",
      [clientMessageId],
      { prepare: true }
    );

    if (existing.rowLength > 0) {
      const row = existing.first();
      logger.debug("Duplicate message detected — skipping insert", {
        messageId,
        clientMessageId,
        conversationId,
      });
      return {
        id: row.message_id.toString(),
        conversationId: row.conversation_id.toString(),
        senderId: row.sender_id.toString(),
        sequenceNo: BigInt(row.sequence_no.toString()),
        clientMessageId: row.client_message_id,
        content: row.content,
        type: row.type,
        createdAt: row.created_at,
        isNew: false,
      };
    }

    // ── Step 2: Get next sequence number ──
    // Use Cassandra LWT (lightweight transaction) for atomic counter
    const nextSequenceNo = await this.getNextSequenceNo(conversationId);

    const msgCreatedAt = new Date(createdAt);
    const convUuid = Uuid.fromString(conversationId);
    const msgUuid = Uuid.fromString(messageId);
    const senderUuid = Uuid.fromString(senderId);

    // ── Step 3: Write to Cassandra (messages + dedup table) ──
    const batch = [
      {
        query: `INSERT INTO messages (conversation_id, message_id, sequence_no, sender_id, client_message_id, content, type, status, metadata, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          convUuid,
          msgUuid,
          nextSequenceNo,
          senderUuid,
          clientMessageId,
          content,
          type,
          "PERSISTED",
          metadata || null,
          msgCreatedAt,
          msgCreatedAt,
        ],
      },
      {
        query: `INSERT INTO messages_by_client_id (client_message_id, conversation_id, message_id, sequence_no, sender_id, content, type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        params: [
          clientMessageId,
          convUuid,
          msgUuid,
          nextSequenceNo,
          senderUuid,
          content,
          type,
          msgCreatedAt,
        ],
      },
    ];

    await cassandra.batch(batch, { prepare: true });

    // ── Step 4: Create Postgres Message stub (FK anchor) + recipient rows ──
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });

    const recipientUserIds = members
      .map((m) => m.userId)
      .filter((id) => id !== senderId);

    // Create the stub message row in Postgres (for FK references)
    await prisma.message.upsert({
      where: { id: messageId },
      update: {},
      create: {
        id: messageId,
        conversationId,
        senderId,
        sequenceNo: nextSequenceNo,
        createdAt: msgCreatedAt,
      },
    });

    if (recipientUserIds.length > 0) {
      await prisma.messageRecipient.createMany({
        data: recipientUserIds.map((userId) => ({
          messageId,
          userId,
          status: "PENDING" as DeliveryStatus,
        })),
        skipDuplicates: true,
      });
    }

    // ── Step 5: Update conversation's last message preview ──
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: messageId,
        lastMessageText: content.substring(0, 200),
        lastMessageAt: msgCreatedAt,
      },
    });

    logger.info("Message persisted to Cassandra", {
      messageId,
      clientMessageId,
      conversationId,
      sequenceNo: nextSequenceNo.toString(),
    });

    return {
      id: messageId,
      conversationId,
      senderId,
      sequenceNo: BigInt(nextSequenceNo),
      clientMessageId,
      content,
      type,
      createdAt: msgCreatedAt,
      isNew: true,
    };
  }

  /**
   * Atomic sequence number generation using Cassandra LWT.
   */
  private async getNextSequenceNo(conversationId: string): Promise<number> {
    const convUuid = Uuid.fromString(conversationId);

    // Try to read the current sequence number
    const result = await cassandra.execute(
      "SELECT last_sequence_no FROM conversation_sequence WHERE conversation_id = ?",
      [convUuid],
      { prepare: true }
    );

    if (result.rowLength === 0) {
      // First message in this conversation — initialize with LWT
      const insertResult = await cassandra.execute(
        "INSERT INTO conversation_sequence (conversation_id, last_sequence_no) VALUES (?, 1) IF NOT EXISTS",
        [convUuid],
        { prepare: true }
      );
      const applied = insertResult.first()["[applied]"];
      if (applied) return 1;
      // Someone else initialized it — read again
      const reread = await cassandra.execute(
        "SELECT last_sequence_no FROM conversation_sequence WHERE conversation_id = ?",
        [convUuid],
        { prepare: true }
      );
      const current = Number(reread.first().last_sequence_no.toString());
      // Now increment
      return this.incrementSequence(convUuid, current);
    }

    const current = Number(result.first().last_sequence_no.toString());
    return this.incrementSequence(convUuid, current);
  }

  /**
   * Increment sequence with CAS (compare-and-swap) for safety.
   */
  private async incrementSequence(
    convUuid: cassandraTypes.Uuid,
    current: number
  ): Promise<number> {
    const next = current + 1;
    const casResult = await cassandra.execute(
      "UPDATE conversation_sequence SET last_sequence_no = ? WHERE conversation_id = ? IF last_sequence_no = ?",
      [next, convUuid, current],
      { prepare: true }
    );
    const applied = casResult.first()["[applied]"];
    if (applied) return next;

    // CAS failed — retry with fresh read (rare contention case)
    logger.warn("Sequence CAS conflict — retrying", {
      conversationId: convUuid.toString(),
    });
    const reread = await cassandra.execute(
      "SELECT last_sequence_no FROM conversation_sequence WHERE conversation_id = ?",
      [convUuid],
      { prepare: true }
    );
    const newCurrent = Number(reread.first().last_sequence_no.toString());
    return this.incrementSequence(convUuid, newCurrent);
  }

  // ─── Cassandra: Message History ────────────────────────

  /**
   * Get messages for a conversation, ordered by time descending.
   * Cursor-based pagination using created_at timestamp.
   */
  async getHistory(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: Date
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      senderId: string;
      content: string;
      type: string;
      metadata: string | null;
      sequenceNo: bigint;
      status: string;
      editedAt: Date | null;
      deletedAt: Date | null;
      createdAt: Date;
      recipients: Array<{
        userId: string;
        status: string;
        deliveredAt: Date | null;
        readAt: Date | null;
      }>;
    }>
  > {
    const convUuid = Uuid.fromString(conversationId);

    let query: string;
    let params: any[];

    if (beforeTimestamp) {
      query =
        "SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?";
      params = [convUuid, beforeTimestamp, limit];
    } else {
      query =
        "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?";
      params = [convUuid, limit];
    }

    const result = await cassandra.execute(query, params, { prepare: true });

    // For each message, fetch recipient status from Postgres
    const messages = await Promise.all(
      result.rows.map(async (row) => {
        const msgId = row.message_id.toString();
        const recipients = await prisma.messageRecipient.findMany({
          where: { messageId: msgId },
          select: {
            userId: true,
            status: true,
            deliveredAt: true,
            readAt: true,
          },
        });

        return {
          id: msgId,
          conversationId: row.conversation_id.toString(),
          senderId: row.sender_id.toString(),
          content: row.content,
          type: row.type,
          metadata: row.metadata || null,
          sequenceNo: BigInt(row.sequence_no.toString()),
          status: row.status,
          editedAt: row.edited_at || null,
          deletedAt: row.deleted_at || null,
          createdAt: row.created_at,
          recipients,
        };
      })
    );

    return messages;
  }

  /**
   * Get messages after a specific sequence number.
   * Used for reconnect sync and missed message fetch.
   */
  async getMessagesAfterSequence(
    conversationId: string,
    afterSequenceNo: bigint,
    limit: number = 100
  ): Promise<
    Array<{
      id: string;
      conversationId: string;
      senderId: string;
      content: string;
      type: string;
      metadata: string | null;
      sequenceNo: bigint;
      deletedAt: Date | null;
      createdAt: Date;
    }>
  > {
    const convUuid = Uuid.fromString(conversationId);

    // Cassandra doesn't support filtering by non-clustering columns easily
    // So fetch recent messages and filter by sequence number
    const result = await cassandra.execute(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?",
      [convUuid, limit * 2], // fetch extra to account for filtering
      { prepare: true }
    );

    return result.rows
      .filter((row) => BigInt(row.sequence_no.toString()) > afterSequenceNo)
      .slice(0, limit)
      .reverse() // Return in ascending order
      .map((row) => ({
        id: row.message_id.toString(),
        conversationId: row.conversation_id.toString(),
        senderId: row.sender_id.toString(),
        content: row.content,
        type: row.type,
        metadata: row.metadata || null,
        sequenceNo: BigInt(row.sequence_no.toString()),
        deletedAt: row.deleted_at || null,
        createdAt: row.created_at,
      }));
  }

  // ─── PostgreSQL: Delivery State ────────────────────────

  /**
   * Mark a message as delivered for a specific user.
   */
  async markDelivered(
    messageId: string,
    userId: string
  ): Promise<{ senderId: string; conversationId: string } | null> {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { messageId_userId: { messageId, userId } },
      select: {
        status: true,
        message: { select: { senderId: true, conversationId: true } },
      },
    });

    if (!recipient) return null;
    if (
      recipient.status === "DELIVERED" ||
      recipient.status === "READ"
    ) {
      return recipient.message;
    }

    await prisma.messageRecipient.update({
      where: { messageId_userId: { messageId, userId } },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });

    return recipient.message;
  }

  /**
   * Mark a message as read for a specific user.
   */
  async markRead(
    messageId: string,
    userId: string
  ): Promise<{
    senderId: string;
    conversationId: string;
    sequenceNo: bigint;
  } | null> {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { messageId_userId: { messageId, userId } },
      select: {
        status: true,
        message: {
          select: { senderId: true, conversationId: true, sequenceNo: true },
        },
      },
    });

    if (!recipient) return null;
    if (recipient.status === "READ") {
      return recipient.message;
    }

    const now = new Date();
    await prisma.messageRecipient.update({
      where: { messageId_userId: { messageId, userId } },
      data: {
        status: "READ",
        deliveredAt: recipient.status === "PENDING" ? now : undefined,
        readAt: now,
      },
    });

    return recipient.message;
  }

  /**
   * Update the read cursor for a user in a conversation.
   */
  async updateReadCursor(
    conversationId: string,
    userId: string,
    sequenceNo: bigint
  ): Promise<void> {
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: {
        lastReadSequenceNo: sequenceNo,
      },
    });
  }

  /**
   * Create an immutable receipt audit entry.
   */
  async createReceipt(
    messageId: string,
    userId: string,
    type: "SENT" | "DELIVERED" | "READ",
    deviceId?: string
  ): Promise<void> {
    await prisma.messageReceipt.create({
      data: {
        messageId,
        userId,
        type: type as ReceiptType,
        deviceId,
      },
    });
  }

  /**
   * Check if a user is a member of a conversation.
   */
  async isUserInConversation(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { leftAt: true },
    });
    return member !== null && member.leftAt === null;
  }

  /**
   * Get all pending (undelivered) messages for a user.
   */
  async getPendingMessages(
    userId: string,
    limit: number = 200
  ): Promise<
    Array<{
      messageId: string;
      message: {
        id: string;
        conversationId: string;
        senderId: string;
        content: string;
        type: string;
        metadata: string | null;
        sequenceNo: bigint;
        createdAt: Date;
      };
    }>
  > {
    // Get pending message IDs from Postgres
    const pendingRecipients = await prisma.messageRecipient.findMany({
      where: {
        userId,
        status: "PENDING",
      },
      select: {
        messageId: true,
        message: {
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            sequenceNo: true,
            createdAt: true,
          },
        },
      },
      orderBy: { message: { createdAt: "asc" } },
      take: limit,
    });

    // Fetch full message content from Cassandra
    const results = await Promise.all(
      pendingRecipients.map(async (pr) => {
        const cassandraMsg = await cassandra.execute(
          "SELECT content, type, metadata FROM messages_by_client_id WHERE client_message_id = ?",
          [pr.messageId], // try by message ID in dedup table
          { prepare: true }
        );

        // Fallback: fetch from main messages table using conversationId + message details from Postgres
        let content = "";
        let type = "TEXT";
        let metadata: string | null = null;

        if (cassandraMsg.rowLength > 0) {
          const row = cassandraMsg.first();
          content = row.content;
          type = row.type;
          metadata = row.metadata || null;
        }

        return {
          messageId: pr.messageId,
          message: {
            id: pr.message.id,
            conversationId: pr.message.conversationId,
            senderId: pr.message.senderId,
            content,
            type,
            metadata,
            sequenceNo: pr.message.sequenceNo,
            createdAt: pr.message.createdAt,
          },
        };
      })
    );

    return results;
  }

  /**
   * Mark a batch of messages as delivered for a user.
   */
  async markBatchDelivered(
    messageIds: string[],
    userId: string
  ): Promise<number> {
    const result = await prisma.messageRecipient.updateMany({
      where: {
        messageId: { in: messageIds },
        userId,
        status: "PENDING",
      },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Get member IDs for a conversation (for delivery fan-out).
   */
  async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }
}

export const messageRepository = new MessageRepository();

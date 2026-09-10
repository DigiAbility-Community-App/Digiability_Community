// ─────────────────────────────────────────────────────────────
// Message Repository — PostgreSQL only
//
// All message content is stored in the Prisma Message model.
// Atomic sequenceNo generation uses PostgreSQL advisory locks
// (pg_advisory_xact_lock) so no separate sequence table is needed.
//
// Cassandra has been removed — the Message model already has
// every field (content, type, metadata, sequenceNo, etc.) and
// the clientMessageId @unique constraint handles deduplication.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { DeliveryStatus, ReceiptType } from "../generated/client";
import { logger } from "../config/logger";

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
  isNew: boolean;
}

class MessageRepository {

  // ─── Atomic sequence number via PostgreSQL advisory lock ───

  private async getNextSequenceNo(conversationId: string): Promise<bigint> {
    // pg_advisory_xact_lock ensures only one transaction at a time
    // computes the next sequence for a given conversation.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`;
      const agg = await tx.message.aggregate({
        _max: { sequenceNo: true },
        where: { conversationId },
      });
      return (agg._max.sequenceNo ?? BigInt(0)) + BigInt(1);
    });
  }

  // ─── Message Persistence ───────────────────────────────────

  /**
   * Persist a message idempotently using clientMessageId @unique.
   * Steps:
   *  1. Dedup check — return existing if already persisted
   *  2. Atomic sequence number
   *  3. Upsert Message row (content + all fields in one place)
   *  4. Create MessageRecipient rows
   *  5. Update conversation last message preview
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

    const msgCreatedAt = new Date(createdAt);

    // ── Step 1: Dedup check ──
    const existing = await prisma.message.findUnique({
      where: { clientMessageId },
      select: {
        id: true, conversationId: true, senderId: true,
        sequenceNo: true, clientMessageId: true,
        content: true, type: true, createdAt: true,
      },
    });

    if (existing) {
      logger.debug("Duplicate message — skipping insert", { messageId, clientMessageId });
      return {
        id: existing.id,
        conversationId: existing.conversationId,
        senderId: existing.senderId,
        sequenceNo: existing.sequenceNo,
        clientMessageId: existing.clientMessageId,
        content: existing.content,
        type: existing.type,
        createdAt: existing.createdAt,
        isNew: false,
      };
    }

    // ── Step 2: Atomic sequence number ──
    const nextSequenceNo = await this.getNextSequenceNo(conversationId);

    // ── Step 3: Upsert Message (all content stored in PostgreSQL) ──
    await prisma.message.upsert({
      where: { id: messageId },
      update: {},
      create: {
        id: messageId,
        conversationId,
        senderId,
        sequenceNo: nextSequenceNo,
        createdAt: msgCreatedAt,
        clientMessageId,
        content,
        type: type as any,
        status: "PERSISTED" as any,
        metadata: metadata ?? null,
      },
    });

    // ── Step 4: Create recipient rows ──
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });

    const recipientIds = members.map((m) => m.userId).filter((id) => id !== senderId);

    if (recipientIds.length > 0) {
      await prisma.messageRecipient.createMany({
        data: recipientIds.map((userId) => ({
          messageId,
          userId,
          status: "PENDING" as DeliveryStatus,
        })),
        skipDuplicates: true,
      });
    }

    // ── Step 5: Update conversation last message preview ──
    // Non-text messages store the uploaded file's path/URL as `content` —
    // show a friendly label instead of leaking that raw path into the list.
    const previewText =
      type === "IMAGE" ? "📷 Photo" :
      type === "VIDEO" ? "🎥 Video" :
      type === "AUDIO" ? "🎤 Voice message" :
      type === "FILE" ? "📎 File" :
      content.substring(0, 200);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: messageId,
        lastMessageText: previewText,
        lastMessageAt: msgCreatedAt,
      },
    });

    logger.info("Message persisted to PostgreSQL", {
      messageId, clientMessageId, conversationId,
      sequenceNo: nextSequenceNo.toString(),
    });

    return {
      id: messageId,
      conversationId,
      senderId,
      sequenceNo: nextSequenceNo,
      clientMessageId,
      content,
      type,
      createdAt: msgCreatedAt,
      isNew: true,
    };
  }

  // ─── Message History ───────────────────────────────────────

  /**
   * Get messages for a conversation, ordered newest first.
   * Cursor-based pagination via beforeTimestamp.
   */
  async getHistory(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: Date
  ) {
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        ...(beforeTimestamp ? { createdAt: { lt: beforeTimestamp } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        recipients: {
          select: { userId: true, status: true, deliveredAt: true, readAt: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      clientMessageId: row.clientMessageId,
      conversationId: row.conversationId,
      senderId: row.senderId,
      content: row.content,
      type: row.type,
      metadata: row.metadata ?? null,
      sequenceNo: row.sequenceNo,
      status: row.status,
      editedAt: row.editedAt ?? null,
      deletedAt: row.deletedAt ?? null,
      createdAt: row.createdAt,
      recipients: row.recipients,
    }));
  }

  /**
   * Get messages after a specific sequence number.
   * Used for reconnect sync and missed message fetch.
   */
  async getMessagesAfterSequence(
    conversationId: string,
    afterSequenceNo: bigint,
    limit: number = 100
  ) {
    const rows = await prisma.message.findMany({
      where: {
        conversationId,
        sequenceNo: { gt: afterSequenceNo },
        // Deleted messages must not come back through sync. REST history
        // already filters them, but this path did not — and since the client
        // syncs from sequence 0, every reconnect replayed deleted messages
        // back into the store, which is why a deleted image reappeared as an
        // empty box after a refresh.
        deletedAt: null,
      },
      orderBy: { sequenceNo: "asc" },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      clientMessageId: row.clientMessageId,
      conversationId: row.conversationId,
      senderId: row.senderId,
      content: row.content,
      type: row.type,
      metadata: row.metadata ?? null,
      sequenceNo: row.sequenceNo,
      deletedAt: row.deletedAt ?? null,
      createdAt: row.createdAt,
    }));
  }

  // ─── Delivery State (PostgreSQL) ──────────────────────────

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
    if (recipient.status === "DELIVERED" || recipient.status === "READ") {
      return recipient.message;
    }

    await prisma.messageRecipient.update({
      where: { messageId_userId: { messageId, userId } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });

    return recipient.message;
  }

  async markRead(
    messageId: string,
    userId: string
  ): Promise<{ senderId: string; conversationId: string; sequenceNo: bigint } | null> {
    const recipient = await prisma.messageRecipient.findUnique({
      where: { messageId_userId: { messageId, userId } },
      select: {
        status: true,
        message: { select: { senderId: true, conversationId: true, sequenceNo: true } },
      },
    });

    if (!recipient) return null;
    if (recipient.status === "READ") return recipient.message;

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

  /** Look up a message's sequence number by id (null if it doesn't exist). */
  async getMessageSequenceNo(messageId: string): Promise<bigint | null> {
    const m = await prisma.message.findUnique({
      where: { id: messageId },
      select: { sequenceNo: true },
    });
    return m?.sequenceNo ?? null;
  }

  async updateReadCursor(
    conversationId: string,
    userId: string,
    sequenceNo: bigint
  ): Promise<void> {
    // Forward-only: never move the cursor backwards (out-of-order reads) and
    // no-op if the member row is missing. updateMany avoids throwing on a
    // non-existent row.
    await prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId,
        lastReadSequenceNo: { lt: sequenceNo },
      },
      data: { lastReadSequenceNo: sequenceNo },
    });
  }

  async createReceipt(
    messageId: string,
    userId: string,
    type: "SENT" | "DELIVERED" | "READ",
    deviceId?: string
  ): Promise<void> {
    await prisma.messageReceipt.create({
      data: { messageId, userId, type: type as ReceiptType, deviceId },
    });
  }

  async isUserInConversation(conversationId: string, userId: string): Promise<boolean> {
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { leftAt: true },
    });
    return member !== null && member.leftAt === null;
  }

  // ─── Pending Messages (reconnect sync) ────────────────────

  async getPendingMessages(userId: string, limit: number = 200) {
    const pending = await prisma.messageRecipient.findMany({
      where: { userId, status: "PENDING" },
      select: {
        messageId: true,
        message: {
          select: {
            id: true, conversationId: true, senderId: true,
            clientMessageId: true, content: true, type: true,
            metadata: true, sequenceNo: true, createdAt: true,
          },
        },
      },
      orderBy: { message: { createdAt: "asc" } },
      take: limit,
    });

    return pending.map((pr) => ({
      messageId: pr.messageId,
      message: {
        id: pr.message.id,
        clientMessageId: pr.message.clientMessageId,
        conversationId: pr.message.conversationId,
        senderId: pr.message.senderId,
        content: pr.message.content,
        type: pr.message.type,
        metadata: pr.message.metadata ?? null,
        sequenceNo: pr.message.sequenceNo,
        createdAt: pr.message.createdAt,
      },
    }));
  }

  async markBatchDelivered(messageIds: string[], userId: string): Promise<number> {
    const result = await prisma.messageRecipient.updateMany({
      where: { messageId: { in: messageIds }, userId, status: "PENDING" },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    return result.count;
  }

  async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ─── Message Deletion ─────────────────────────────────────

  async softDeleteMessage(messageId: string, conversationId: string): Promise<void> {
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), status: "DELETED" as any },
    });

    // Roll the conversation's last-message preview back to the newest
    // surviving message. lastMessageText is written only when a message is
    // persisted, so deleting the most recent one previously left "📷 Photo"
    // (or the message text) sitting in the conversation list indefinitely.
    await this.refreshLastMessagePreview(conversationId);

    logger.info("Message soft-deleted", { messageId, conversationId });
  }

  /**
   * Recompute a conversation's last-message preview from its newest
   * non-deleted message. Mirrors the preview format used when persisting.
   *
   * Note this is inherently conversation-wide: lastMessageText is a single
   * column, so it cannot reflect a per-user "delete for me".
   */
  async refreshLastMessagePreview(conversationId: string): Promise<void> {
    const latest = await prisma.message.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: { sequenceNo: "desc" },
      select: { id: true, type: true, content: true, createdAt: true },
    });

    if (!latest) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageId: null, lastMessageText: null, lastMessageAt: null },
      });
      return;
    }

    const previewText =
      latest.type === "IMAGE" ? "📷 Photo" :
      latest.type === "VIDEO" ? "🎥 Video" :
      latest.type === "AUDIO" ? "🎤 Voice message" :
      latest.type === "FILE" ? "📎 File" :
      (latest.content ?? "").substring(0, 200);

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: latest.id,
        lastMessageText: previewText,
        lastMessageAt: latest.createdAt,
      },
    });
  }

  async getMessageById(
    messageId: string,
    _conversationId: string
  ): Promise<{ senderId: string; createdAt: Date; status: string } | null> {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, createdAt: true, status: true },
    });
    if (!msg) return null;
    return { senderId: msg.senderId, createdAt: msg.createdAt, status: msg.status };
  }

  async hideMessageForUser(userId: string, messageId: string): Promise<void> {
    await prisma.hiddenMessage.upsert({
      where: { userId_messageId: { userId, messageId } },
      update: {},
      create: { userId, messageId },
    });
    logger.info("Message hidden for user", { userId, messageId });
  }

  async getHiddenMessageIds(userId: string, messageIds: string[]): Promise<Set<string>> {
    if (messageIds.length === 0) return new Set();
    const hidden = await prisma.hiddenMessage.findMany({
      where: { userId, messageId: { in: messageIds } },
      select: { messageId: true },
    });
    return new Set(hidden.map((h) => h.messageId));
  }
}

export const messageRepository = new MessageRepository();

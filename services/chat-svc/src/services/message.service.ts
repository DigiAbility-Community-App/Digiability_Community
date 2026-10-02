// ─────────────────────────────────────────────────────────────
// Message Service
//
// Business logic for message operations exposed via REST API.
// WebSocket message creation is handled directly in the
// message handler → stream producer path (for low latency).
// This service handles the REST-based query operations.
// ─────────────────────────────────────────────────────────────

import { messageRepository } from "../repositories/message.repository";
import { conversationRepository } from "../repositories/conversation.repository";
import { logger } from "../config/logger";
import { connectionManager } from "../websocket/connection-manager";
import { WS_EVENTS } from "../types/ws-events";
import { createError } from "../middleware/error.middleware";
import { publishMessagePersisted } from "../streams/producer";
import { generateMessageId } from "../utils/id.util";
import {
  getConversationSuspension,
  suspensionRejectionReason,
} from "../utils/suspension.util";

/** senderId the admin panel posts group announcements under. */
export const ADMIN_SENDER_ID = "digiability-admin";

class MessageService {
  /**
   * Get message history for a conversation.
   * Verifies membership before returning messages.
   */
  async getHistory(
    conversationId: string,
    userId: string,
    limit: number = 50,
    beforeTimestampMs?: number
  ) {
    // Verify membership
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) {
      throw new Error("Not a member of this conversation");
    }

    const beforeTimestamp = beforeTimestampMs ? new Date(beforeTimestampMs) : undefined;

    const messages = await messageRepository.getHistory(
      conversationId,
      limit + 1,
      beforeTimestamp
    );

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;

    // Drop messages this user deleted "for me" (HiddenMessage) so they don't
    // reappear on refetch. hasMore/nextCursor stay based on the fetched page
    // boundary so pagination isn't skewed by the hidden ones being removed.
    const visible = await this.stripHidden(userId, result);

    // Sanitize deleted messages. metadata is cleared too, not just content:
    // an image's caption lives in metadata.altText, so preserving it left the
    // caption rendered under a deleted image.
    const sanitized = visible.map((msg) => ({
      ...msg,
      content: msg.deletedAt ? "" : msg.content,
      metadata: msg.deletedAt ? null : msg.metadata,
      sequenceNo: Number(msg.sequenceNo),
    }));

    return {
      messages: sanitized,
      hasMore,
      nextCursor: hasMore && result.length > 0
        ? result[result.length - 1].createdAt.getTime()
        : undefined,
    };
  }

  /**
   * Remove messages the user has hidden via "delete for me" (HiddenMessage).
   */
  private async stripHidden<T extends { id: string }>(
    userId: string,
    messages: T[]
  ): Promise<T[]> {
    if (messages.length === 0) return messages;
    const hiddenIds = await messageRepository.getHiddenMessageIds(
      userId,
      messages.map((m) => m.id)
    );
    return hiddenIds.size === 0 ? messages : messages.filter((m) => !hiddenIds.has(m.id));
  }

  /**
   * Get missed messages since a specific sequence number.
   * Used by REST-based reconnect sync as an alternative to WS sync.
   */
  async getMissedMessages(
    conversationId: string,
    userId: string,
    lastSequenceNo: number = 0,
    limit: number = 100
  ) {
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) {
      throw new Error("Not a member of this conversation");
    }

    const messages = await messageRepository.getMessagesAfterSequence(
      conversationId,
      BigInt(lastSequenceNo),
      limit + 1
    );

    const hasMore = messages.length > limit;
    const result = hasMore ? messages.slice(0, limit) : messages;

    // Exclude "delete for me" messages (see getHistory).
    const visible = await this.stripHidden(userId, result);

    const sanitized = visible.map((msg) => ({
      ...msg,
      content: msg.deletedAt ? "" : msg.content,
      // See getHistory — the caption lives in metadata.altText.
      metadata: msg.deletedAt ? null : msg.metadata,
      sequenceNo: Number(msg.sequenceNo),
    }));

    return {
      messages: sanitized,
      hasMore,
      nextCursor: hasMore
        ? Number(result[result.length - 1].sequenceNo)
        : undefined,
    };
  }

  /**
   * Get unread message count for a user across all conversations.
   */
  async getUnreadCounts(userId: string): Promise<Array<{
    conversationId: string;
    unreadCount: number;
  }>> {
    const { conversations } = await conversationRepository.listForUser(userId, 200);

    const counts: Array<{ conversationId: string; unreadCount: number }> = [];

    for (const conv of conversations) {
      const member = conv.members.find((m) => m.userId === userId);
      if (!member) continue;

      const lastRead = member.lastReadSequenceNo;
      const messages = await messageRepository.getMessagesAfterSequence(
        conv.id,
        lastRead,
        1 // We only need to know if there ARE unread messages
      );

      if (messages.length > 0) {
        // Get actual count
        const allUnread = await messageRepository.getMessagesAfterSequence(
          conv.id,
          lastRead,
          1000
        );
        // Count only messages the user can actually see: not their own, not
        // soft-deleted (deleted for everyone), and not hidden by them
        // (delete-for-me). Otherwise a deleted/hidden message leaves a phantom
        // unread that the badge shows but the user can never open away.
        const candidates = allUnread.filter(m => m.senderId !== userId && !m.deletedAt);
        const hiddenIds = await messageRepository.getHiddenMessageIds(
          userId,
          candidates.map(m => m.id)
        );
        const actualUnread = candidates.filter(m => !hiddenIds.has(m.id));

        // Deduplicate by messageId in case of multiple sequence numbers for same message
        const uniqueUnread = new Set(actualUnread.map(m => m.id));

        if (uniqueUnread.size > 0) {
          counts.push({
            conversationId: conv.id,
            unreadCount: uniqueUnread.size,
          });
        }
      }
    }

    return counts;
  }

  /**
   * Admin-initiated deletion (moderation panel). Goes through the normal
   * service layer — not raw SQL — so members get a real-time MESSAGE_DELETED
   * WS event instead of the removal silently taking effect on their next
   * fetch, mirroring conversationService.adminDeleteGroup/softDeleteAndNotify.
   */
  async adminDeleteMessage(messageId: string, conversationId: string): Promise<void> {
    const memberIds = await conversationRepository.getMemberIds(conversationId);

    await messageRepository.softDeleteMessage(messageId, conversationId);

    const envelope = {
      event: WS_EVENTS.MESSAGE_DELETED,
      data: { messageId, conversationId, deletedBy: "admin", timestamp: Date.now() },
      timestamp: Date.now(),
    };
    for (const memberId of memberIds) {
      connectionManager.sendToUser(memberId, envelope);
    }

    logger.info("Message soft-deleted and broadcast", { messageId, conversationId });
  }

  /**
   * Admin-panel announcement into a group chat.
   *
   * The admin panel used to INSERT into chat.messages with raw SQL, which
   * skipped the msg:persisted stream — so online members never got a
   * message.new event and saw nothing until they reopened the chat — and
   * computed sequenceNo without the advisory lock. This goes through the same
   * persistMessage() + publishMessagePersisted() pair the msg-svc worker uses,
   * so delivery.worker fans it out over WebSocket like any other message.
   *
   * Returns only once the row is persisted. `liveDelivered` is false when the
   * stream publish failed: the message is saved and shows up on the next
   * history fetch, but members with the chat already open won't see it live.
   */
  async adminPostAnnouncement(
    conversationId: string,
    content: string,
    metadata: string
  ): Promise<{ messageId: string; sequenceNo: string; liveDelivered: boolean }> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation || conversation.type !== "GROUP") {
      throw createError("Group not found or has been deleted.", 404);
    }

    const suspension = getConversationSuspension(conversation);
    if (suspension) {
      throw createError(suspensionRejectionReason(suspension), 409);
    }

    const persisted = await messageRepository.persistMessage({
      messageId: generateMessageId(),
      conversationId,
      senderId: ADMIN_SENDER_ID,
      clientMessageId: generateMessageId(),
      content,
      type: "TEXT",
      metadata,
      createdAt: new Date().toISOString(),
    });

    let liveDelivered = true;
    try {
      await publishMessagePersisted({
        messageId: persisted.id,
        conversationId,
        senderId: ADMIN_SENDER_ID,
        senderName: "DigiAbility Admin",
        clientMessageId: persisted.clientMessageId,
        content: persisted.content,
        type: persisted.type,
        metadata,
        sequenceNo: persisted.sequenceNo.toString(),
        createdAt: persisted.createdAt.toISOString(),
      });
    } catch (err) {
      liveDelivered = false;
      logger.error("Admin announcement persisted but stream publish failed", {
        messageId: persisted.id,
        conversationId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    logger.info("Admin announcement posted", {
      messageId: persisted.id,
      conversationId,
      sequenceNo: persisted.sequenceNo.toString(),
      liveDelivered: String(liveDelivered),
    });

    return {
      messageId: persisted.id,
      sequenceNo: persisted.sequenceNo.toString(),
      liveDelivered,
    };
  }
}

export const messageService = new MessageService();

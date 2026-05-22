// ─────────────────────────────────────────────────────────────
// Conversation Service
//
// Business logic layer for conversation operations.
// Orchestrates between repository and validation.
// ─────────────────────────────────────────────────────────────

import { conversationRepository, CreateConversationInput, ConversationWithMembers } from "../repositories/conversation.repository";
import { logger } from "../config/logger";

class ConversationService {
  /**
   * Create a new conversation.
   * For DMs: returns existing if one already exists between the two users.
   * For Groups: creates new with creator as OWNER.
   * Supports self-conversations (like WhatsApp "Message Yourself").
   */
  async createConversation(
    creatorId: string,
    type: "DIRECT" | "GROUP",
    memberIds: string[],
    name?: string
  ): Promise<ConversationWithMembers> {
    // Self-conversation: user messaging themselves
    const isSelfConversation =
      type === "DIRECT" &&
      memberIds.length === 1 &&
      memberIds[0] === creatorId;

    if (type === "DIRECT" && !isSelfConversation && memberIds.length !== 1) {
      throw new Error("Direct conversations must have exactly one other member");
    }

    if (type === "GROUP" && !name) {
      throw new Error("Group conversations must have a name");
    }

    // For self-conversations, pass empty uniqueMembers — repository handles it
    const uniqueMembers = isSelfConversation
      ? [] // creator-only conversation
      : [...new Set(memberIds.filter((id) => id !== creatorId))];

    if (!isSelfConversation && uniqueMembers.length === 0) {
      throw new Error("At least one other member is required");
    }

    const conversation = await conversationRepository.create({
      type: type as any,
      name,
      createdBy: creatorId,
      memberIds: uniqueMembers,
    });

    logger.info("Conversation created via service", {
      conversationId: conversation.id,
      userId: creatorId,
      isSelfConversation,
    });

    return conversation;
  }

  /**
   * List conversations for a user with pagination.
   */
  async listConversations(
    userId: string,
    limit: number = 50,
    cursor?: string
  ) {
    return conversationRepository.listForUser(userId, limit, cursor);
  }

  /**
   * Get a single conversation by ID (with membership check).
   */
  async getConversation(
    conversationId: string,
    userId: string
  ): Promise<ConversationWithMembers | null> {
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) return null;

    return conversationRepository.getById(conversationId);
  }

  /**
   * Add a member to a group conversation.
   * Only OWNER or ADMIN can add members.
   */
  async addMember(
    conversationId: string,
    requesterId: string,
    newMemberId: string
  ): Promise<void> {
    const role = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!role || (role !== "OWNER" && role !== "ADMIN")) {
      throw new Error("Only owners and admins can add members");
    }

    await conversationRepository.addMember(conversationId, newMemberId);

    logger.info("Member added to conversation", {
      conversationId,
      userId: newMemberId,
    });
  }

  /**
   * Remove a member from a group conversation.
   * OWNER can remove anyone. ADMIN can remove MEMBER only.
   */
  async removeMember(
    conversationId: string,
    requesterId: string,
    targetMemberId: string
  ): Promise<void> {
    // Self-removal is always allowed (leaving)
    if (requesterId === targetMemberId) {
      await conversationRepository.removeMember(conversationId, targetMemberId);
      return;
    }

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole || requesterRole === "MEMBER") {
      throw new Error("Only owners and admins can remove members");
    }

    const targetRole = await conversationRepository.getMemberRole(conversationId, targetMemberId);
    if (targetRole === "OWNER") {
      throw new Error("Cannot remove the owner");
    }

    if (requesterRole === "ADMIN" && targetRole === "ADMIN") {
      throw new Error("Admins cannot remove other admins");
    }

    await conversationRepository.removeMember(conversationId, targetMemberId);

    logger.info("Member removed from conversation", {
      conversationId,
      userId: targetMemberId,
    });
  }
}

export const conversationService = new ConversationService();

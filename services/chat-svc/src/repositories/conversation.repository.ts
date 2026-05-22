// ─────────────────────────────────────────────────────────────
// Conversation Repository
//
// All database queries for conversation-related operations.
// Uses Prisma for type-safe PostgreSQL access.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { ConversationType, MemberRole } from "@prisma/client";
import { logger } from "../config/logger";

export interface CreateConversationInput {
  type: ConversationType;
  name?: string;
  createdBy: string;
  memberIds: string[];  // Does NOT include the creator (added automatically)
}

export interface ConversationWithMembers {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  createdBy: string;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  members: Array<{
    userId: string;
    role: MemberRole;
    lastReadSequenceNo: bigint;
    isMuted: boolean;
  }>;
  _count?: { messages: number };
}

class ConversationRepository {
  /**
   * Create a new conversation with members.
   * For DIRECT conversations, checks if one already exists between the two users.
   * Supports self-conversations (memberIds is empty).
   */
  async create(input: CreateConversationInput): Promise<ConversationWithMembers> {
    const { type, name, createdBy, memberIds } = input;

    // Self-conversation: check for existing self-DM
    const isSelfConversation = type === "DIRECT" && memberIds.length === 0;

    if (type === "DIRECT") {
      if (isSelfConversation) {
        // Check for existing self-conversation
        const existing = await this.findDirectConversation(createdBy, createdBy);
        if (existing) return existing;
      } else {
        if (memberIds.length !== 1) {
          throw new Error("DIRECT conversations must have exactly one other member");
        }
        const existing = await this.findDirectConversation(createdBy, memberIds[0]);
        if (existing) return existing;
      }
    }

    // Build member entries: creator is OWNER, others are MEMBER
    const allMemberIds = isSelfConversation
      ? [createdBy]
      : [createdBy, ...memberIds.filter((id) => id !== createdBy)];

    const conversation = await prisma.conversation.create({
      data: {
        type,
        name: type === "GROUP" ? name : null,
        createdBy,
        members: {
          create: allMemberIds.map((userId, index) => ({
            userId,
            role: index === 0 ? "OWNER" as MemberRole : "MEMBER" as MemberRole,
          })),
        },
      },
      include: {
        members: {
          select: {
            userId: true,
            role: true,
            lastReadSequenceNo: true,
            isMuted: true,
          },
        },
      },
    });

    logger.info("Conversation created", {
      conversationId: conversation.id,
      userId: createdBy,
      isSelfConversation,
    });

    return conversation;
  }

  /**
   * Find an existing DM conversation between two users.
   */
  async findDirectConversation(
    userId1: string,
    userId2: string
  ): Promise<ConversationWithMembers | null> {
    // Find conversations where both users are members and type is DIRECT
    const conversations = await prisma.conversation.findMany({
      where: {
        type: "DIRECT",
        deletedAt: null,
        AND: [
          { members: { some: { userId: userId1, leftAt: null } } },
          { members: { some: { userId: userId2, leftAt: null } } },
        ],
      },
      include: {
        members: {
          where: { leftAt: null },
          select: {
            userId: true,
            role: true,
            lastReadSequenceNo: true,
            isMuted: true,
          },
        },
      },
      take: 1,
    });

    return conversations[0] ?? null;
  }

  /**
   * Get a conversation by ID with members.
   */
  async getById(conversationId: string): Promise<ConversationWithMembers | null> {
    return prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: {
        members: {
          where: { leftAt: null },
          select: {
            userId: true,
            role: true,
            lastReadSequenceNo: true,
            isMuted: true,
          },
        },
      },
    });
  }

  /**
   * List all conversations for a user, ordered by most recent activity.
   */
  async listForUser(
    userId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<{ conversations: ConversationWithMembers[]; hasMore: boolean }> {
    const conversations = await prisma.conversation.findMany({
      where: {
        deletedAt: null,
        members: {
          some: { userId, leftAt: null },
        },
      },
      include: {
        members: {
          where: { leftAt: null },
          select: {
            userId: true,
            role: true,
            lastReadSequenceNo: true,
            isMuted: true,
          },
        },
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = conversations.length > limit;
    const result = hasMore ? conversations.slice(0, limit) : conversations;

    return { conversations: result, hasMore };
  }

  /**
   * Check if a user is an active member of a conversation.
   */
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      select: { leftAt: true },
    });

    return member !== null && member.leftAt === null;
  }

  /**
   * Get all active member IDs for a conversation.
   * Used for fan-out and typing indicators.
   */
  async getMemberIds(conversationId: string): Promise<string[]> {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  }

  /**
   * Get member role (for permission checks on group actions).
   */
  async getMemberRole(
    conversationId: string,
    userId: string
  ): Promise<MemberRole | null> {
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      select: { role: true, leftAt: true },
    });

    if (!member || member.leftAt) return null;
    return member.role;
  }

  /**
   * Update the last message preview on a conversation.
   * Called by the msg-svc worker after persisting a message.
   */
  async updateLastMessage(
    conversationId: string,
    messageId: string,
    text: string,
    timestamp: Date
  ): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageId: messageId,
        lastMessageText: text.substring(0, 200), // Truncate for preview
        lastMessageAt: timestamp,
      },
    });
  }

  /**
   * Add a member to a group conversation.
   */
  async addMember(
    conversationId: string,
    userId: string,
    role: MemberRole = "MEMBER"
  ): Promise<void> {
    await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      update: { leftAt: null, role },
      create: { conversationId, userId, role },
    });
  }

  /**
   * Remove a member from a conversation (soft leave).
   */
  async removeMember(conversationId: string, userId: string): Promise<void> {
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { leftAt: new Date() },
    });
  }
}

export const conversationRepository = new ConversationRepository();

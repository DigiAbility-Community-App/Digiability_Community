// ─────────────────────────────────────────────────────────────
// Conversation Repository
//
// All database queries for conversation-related operations.
// Uses Prisma for type-safe PostgreSQL access.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { Prisma, ConversationType, GroupSubType, MemberRole } from "../generated/client";
import { logger } from "../config/logger";

export interface CreateConversationInput {
  type: ConversationType;
  subType?: GroupSubType;
  name?: string;
  description?: string;
  createdBy: string;
  memberIds: string[];  // Does NOT include the creator (added automatically)
  memberRoles?: Array<{ userId: string; role: MemberRole }>;
}

export interface ConversationWithMembers {
  id: string;
  type: ConversationType;
  subType: GroupSubType | null;
  name: string | null;
  description: string | null;
  avatarUrl: string | null;
  createdBy: string;
  maxMembers: number;
  editGroupInfo: string;
  addMembers: string;
  sendMessages: string;
  approveNewMembers: boolean;
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
    const { type, subType, name, description, createdBy, memberIds, memberRoles } = input;

    // Self-conversation: user messaging themselves
    const isSelfConversation =
      type === "DIRECT" &&
      memberIds.length === 1 &&
      memberIds[0] === createdBy;

    if (type === "DIRECT" && !isSelfConversation && memberIds.length !== 1) {
      throw new Error("Direct conversations must have exactly one other member");
    }

    if (type === "GROUP" && !name) {
      throw new Error("Group conversations must have a name");
    }

    // For self-conversations, pass empty uniqueMembers — repository handles it
    const uniqueMembers = isSelfConversation
      ? [] // creator-only conversation
      : [...new Set(memberIds.filter((id) => id !== createdBy))];

    if (type === "DIRECT" && !isSelfConversation && uniqueMembers.length === 0) {
      throw new Error("At least one other member is required");
    }

    if (type === "DIRECT") {
      if (isSelfConversation) {
        const existing = await this.findDirectConversation(createdBy, createdBy);
        if (existing) return existing;
      } else {
        const existing = await this.findDirectConversation(createdBy, uniqueMembers[0]);
        if (existing) return existing;
      }
    }

    // Determine max members based on subType
    const maxMembers = subType === "CARE_CIRCLE" ? 15 : 256;

    // Build member entries
    const allMemberIds = isSelfConversation
      ? [createdBy]
      : [createdBy, ...uniqueMembers];

    // Build role map from memberRoles if provided
    const roleMap = new Map<string, MemberRole>();
    if (memberRoles) {
      memberRoles.forEach((mr) => roleMap.set(mr.userId, mr.role as MemberRole));
    }

    const conversation = await prisma.conversation.create({
      data: {
        type,
        subType: type === "GROUP" ? (subType || "GENERAL") : null,
        name: type === "GROUP" ? name : null,
        description: type === "GROUP" ? description : null,
        createdBy,
        maxMembers,
        members: {
          create: allMemberIds.map((userId, index) => ({
            userId,
            role: index === 0
              ? "OWNER" as MemberRole
              : (roleMap.get(userId) || "MEMBER" as MemberRole),
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
      subType: conversation.subType,
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
   * Get active member count for a conversation.
   */
  async getMemberCount(conversationId: string): Promise<number> {
    return prisma.conversationMember.count({
      where: { conversationId, leftAt: null },
    });
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

  /**
   * Update a member's role in a conversation.
   */
  async updateMemberRole(
    conversationId: string,
    userId: string,
    role: MemberRole
  ): Promise<void> {
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      data: { role },
    });
  }

  /**
   * Update group info (name, description).
   */
  async updateGroupInfo(
    conversationId: string,
    data: { name?: string; description?: string }
  ): Promise<ConversationWithMembers | null> {
    return prisma.conversation.update({
      where: { id: conversationId },
      data,
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
   * Update group permission settings.
   */
  async updateSettings(
    conversationId: string,
    settings: {
      editGroupInfo?: string;
      addMembers?: string;
      sendMessages?: string;
      approveNewMembers?: boolean;
    }
  ): Promise<ConversationWithMembers | null> {
    return prisma.conversation.update({
      where: { id: conversationId },
      data: settings,
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

  async muteConversation(
    conversationId: string,
    userId: string,
    muted: boolean
  ): Promise<void> {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isMuted: muted },
    });
  }

  async pinConversation(
    conversationId: string,
    userId: string,
    pinned: boolean
  ): Promise<void> {
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { isPinned: pinned },
    });
  }
}

export const conversationRepository = new ConversationRepository();

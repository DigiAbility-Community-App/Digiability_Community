// ─────────────────────────────────────────────────────────────
// Conversation Repository
//
// All database queries for conversation-related operations.
// Uses Prisma for type-safe PostgreSQL access.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { Prisma, ConversationType, GroupSubType, MemberRole } from "../generated/client";
import { logger } from "../config/logger";
import { createError } from "../middleware/error.middleware";

// Shared member projection reused by every query that embeds a conversation's
// member list — keeps the shape (and the fields callers can rely on, notably
// joinedAt for succession's "earliest-joined eligible member" lookup)
// consistent everywhere instead of six near-identical inline copies.
const MEMBER_SELECT = {
  userId: true,
  role: true,
  lastReadSequenceNo: true,
  isMuted: true,
  joinedAt: true,
} as const;

export interface CreateConversationInput {
  type: ConversationType;
  subType?: GroupSubType;
  name?: string;
  description?: string;
  createdBy: string;
  memberIds: string[];  // Does NOT include the creator (added automatically)
  memberRoles?: Array<{ userId: string; role: MemberRole }>;
  // Optional overrides for admin-initiated creation (mobile/web creation
  // never sets these — the Prisma column defaults apply). maxMembers still
  // falls back to the subType default (15/256) when omitted.
  maxMembers?: number;
  editGroupInfo?: string;
  addMembers?: string;
  sendMessages?: string;
  approveNewMembers?: boolean;
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
  // Admin suspension state — separate from `sendMessages`, which is an
  // owner-facing permission. See utils/suspension.util.ts.
  isSuspended: boolean;
  suspendedAt: Date | null;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
  suspensionNote: string | null;
  lastMessageText: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  members: Array<{
    userId: string;
    role: MemberRole;
    lastReadSequenceNo: bigint;
    isMuted: boolean;
    joinedAt: Date;
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
    const {
      type, subType, name, description, createdBy, memberIds, memberRoles,
      maxMembers: maxMembersOverride, editGroupInfo, addMembers, sendMessages, approveNewMembers,
    } = input;

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

    // Determine max members based on subType, unless the caller (admin
    // panel) explicitly overrode it.
    const maxMembers = maxMembersOverride && maxMembersOverride > 0
      ? maxMembersOverride
      : subType === "CARE_CIRCLE" ? 15 : 256;

    // Build member entries
    const allMemberIds = isSelfConversation
      ? [createdBy]
      : [createdBy, ...uniqueMembers];

    // Reject at creation, not just on later adds — memberIds can carry up to
    // 500 entries (Zod cap) with nothing else stopping a GROUP/CARE_CIRCLE
    // from being created straight over its own default capacity.
    if (type === "GROUP" && allMemberIds.length > maxMembers) {
      throw createError(
        `Cannot create group with ${allMemberIds.length} members — limit is ${maxMembers}`,
        400
      );
    }

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
        ...(editGroupInfo ? { editGroupInfo } : {}),
        ...(addMembers ? { addMembers } : {}),
        ...(sendMessages ? { sendMessages } : {}),
        ...(approveNewMembers !== undefined ? { approveNewMembers } : {}),
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
          select: MEMBER_SELECT,
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
          select: MEMBER_SELECT,
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
          select: MEMBER_SELECT,
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
          select: MEMBER_SELECT,
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
   * List community groups of a given subType.
   * - GENERAL: public discovery — all groups visible, isMember flag set per user.
   * - CARE_CIRCLE: private — only circles the requesting user is a member of are returned.
   */
  async listAllGroups(
    subType: "GENERAL" | "CARE_CIRCLE",
    requestingUserId: string,
    limit: number = 50,
    cursor?: string
  ): Promise<{ groups: (ConversationWithMembers & { isMember: boolean })[]; hasMore: boolean }> {
    const where =
      subType === "CARE_CIRCLE"
        ? {
            type: "GROUP" as const,
            subType,
            deletedAt: null,
            members: { some: { userId: requestingUserId, leftAt: null } },
          }
        : { type: "GROUP" as const, subType, deletedAt: null };

    const groups = await prisma.conversation.findMany({
      where,
      include: {
        members: {
          where: { leftAt: null },
          select: MEMBER_SELECT,
        },
      },
      orderBy: [
        { lastMessageAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = groups.length > limit;
    const result = (hasMore ? groups.slice(0, limit) : groups).map((g) => ({
      ...g,
      isMember: g.members.some((m) => m.userId === requestingUserId),
    }));
    return { groups: result, hasMore };
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
    // Start the read cursor at the conversation's current latest sequence so a
    // member who joins a group with history doesn't inherit all prior messages
    // as unread. (Rejoin keeps the existing cursor via the update branch.)
    const agg = await prisma.message.aggregate({
      _max: { sequenceNo: true },
      where: { conversationId },
    });
    const maxSeq = agg._max.sequenceNo ?? BigInt(0);

    await prisma.conversationMember.upsert({
      where: {
        conversationId_userId: { conversationId, userId },
      },
      update: { leftAt: null, role },
      create: { conversationId, userId, role, lastReadSequenceNo: maxSeq },
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
   * Soft-delete a group conversation (owner only, enforced in service).
   * Sets deletedAt so it disappears from all listings.
   */
  async softDeleteConversation(conversationId: string): Promise<void> {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
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
          select: MEMBER_SELECT,
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
          select: MEMBER_SELECT,
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

  /**
   * Set leftAt = now() for every active membership of a user.
   * Called when a user account is deleted so the user disappears from all
   * group member lists. Uses updateMany for efficiency (one query).
   */
  async removeAllMemberships(userId: string): Promise<number> {
    const result = await prisma.conversationMember.updateMany({
      where: { userId, leftAt: null },
      data: { leftAt: new Date() },
    });
    return result.count;
  }

  /**
   * Count active (leftAt null) members holding one of the given admin-capable
   * roles. `excludeUserId` lets a caller ask "ignoring this specific user,
   * does the group still have an active admin?" — used both for the max-3
   * cap (no exclusion) and succession (excluding the user who just became
   * ineligible, e.g. suspended, whose own membership row may still be
   * active).
   */
  async countActiveAdmins(
    conversationId: string,
    adminRoles: MemberRole[],
    excludeUserId?: string
  ): Promise<number> {
    return prisma.conversationMember.count({
      where: {
        conversationId,
        leftAt: null,
        role: { in: adminRoles },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
    });
  }

  /**
   * The earliest-joined active member who does NOT already hold an
   * admin-capable role — the succession candidate ("the next member which
   * is added to the group after admin").
   */
  async getEarliestActiveNonAdmin(
    conversationId: string,
    adminRoles: MemberRole[],
    excludeUserId?: string
  ): Promise<{ userId: string; role: MemberRole; joinedAt: Date } | null> {
    return prisma.conversationMember.findFirst({
      where: {
        conversationId,
        leftAt: null,
        role: { notIn: adminRoles },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      orderBy: { joinedAt: "asc" },
      select: { userId: true, role: true, joinedAt: true },
    });
  }

  /**
   * Returns { userId, leftAt } for EVERY member a conversation has ever
   * had — current members (leftAt: null) AND former members who left or
   * were removed. Deliberately separate from every other member query in
   * this repository, which all filter to leftAt: null for membership
   * gating, permission checks, member counts, and the Group Info member
   * list. Do NOT use this for any of those — it exists solely so a
   * historical message sender who has since left the group can still have
   * their name resolved (and labeled "(Removed)") on the client, instead
   * of falling back to a bare "Unknown".
   */
  async getMembersForNameResolution(
    conversationId: string
  ): Promise<Array<{ userId: string; leftAt: Date | null }>> {
    return prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true, leftAt: true },
    });
  }

  /**
   * Conversation IDs where this user currently holds an active admin-capable
   * role for that conversation's own subType — used to know which groups
   * need a succession check when the user becomes ineligible (suspended) or
   * before their memberships are stripped (deleted/banned).
   */
  async getActiveAdminConversationIds(userId: string): Promise<Array<{ conversationId: string; subType: GroupSubType | null }>> {
    const rows = await prisma.conversationMember.findMany({
      where: {
        userId,
        leftAt: null,
        role: { in: ["OWNER", "ADMIN", "CAREGIVER"] },
        conversation: { deletedAt: null, type: "GROUP" },
      },
      select: {
        conversationId: true,
        conversation: { select: { subType: true } },
      },
    });
    return rows.map((r) => ({ conversationId: r.conversationId, subType: r.conversation.subType }));
  }
}

export const conversationRepository = new ConversationRepository();

// ─────────────────────────────────────────────────────────────
// Conversation Service
//
// Business logic layer for conversation operations.
// Orchestrates between repository and validation.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { conversationRepository, CreateConversationInput, ConversationWithMembers } from "../repositories/conversation.repository";
import { MemberRole, ConversationType, GroupSubType } from "../generated/client";
import { logger } from "../config/logger";
import { connectionManager } from "../websocket/connection-manager";
import { WS_EVENTS } from "../types/ws-events";
import {
  CARE_CIRCLE_ADMIN_ROLES,
  GROUP_ADMIN_ROLES,
  MAX_ADMINS_PER_GROUP,
  hasAdminAccess,
  adminRolesFor,
  adminRoleToPromoteTo,
} from "../utils/roles.util";

async function broadcastToConversation(conversationId: string, event: string, data: any): Promise<void> {
  const memberIds = await conversationRepository.getMemberIds(conversationId);
  const envelope = { event, data, timestamp: Date.now() };
  for (const memberId of memberIds) {
    connectionManager.sendToUser(memberId, envelope);
  }
}

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
    name?: string,
    subType?: "GENERAL" | "CARE_CIRCLE",
    description?: string,
    memberRoles?: Array<{ userId: string; role: string }>,
    groupSettings?: {
      maxMembers?: number;
      editGroupInfo?: string;
      addMembers?: string;
      sendMessages?: string;
      approveNewMembers?: boolean;
    }
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

    // Validate Care Circle constraints
    if (subType === "CARE_CIRCLE") {
      // Validate that only valid Care Circle roles are assigned
      if (memberRoles) {
        const validCareCircleRoles = ["MEMBER", "CAREGIVER", "MENTOR", "PROFESSIONAL"];
        for (const mr of memberRoles) {
          if (!validCareCircleRoles.includes(mr.role)) {
            throw new Error(`Invalid Care Circle role: ${mr.role}. Valid roles: ${validCareCircleRoles.join(", ")}`);
          }
        }
      }
    }

    // The creator always becomes OWNER (below), which already counts toward
    // the admin cap — reject up front if the requested initial roles would
    // push the group over MAX_ADMINS_PER_GROUP before anything is written.
    if (type === "GROUP") {
      const adminRoles = adminRolesFor((subType || "GENERAL") as GroupSubType);
      const initialAdminCount = 1 + (memberRoles || []).filter((mr) => adminRoles.includes(mr.role as MemberRole)).length;
      if (initialAdminCount > MAX_ADMINS_PER_GROUP) {
        throw new Error(`A group can have at most ${MAX_ADMINS_PER_GROUP} admins (including the owner).`);
      }
    }

    // For self-conversations, pass empty uniqueMembers — repository handles it
    const uniqueMembers = isSelfConversation
      ? [] // creator-only conversation
      : [...new Set(memberIds.filter((id) => id !== creatorId))];

    if (type === "DIRECT" && !isSelfConversation && uniqueMembers.length === 0) {
      throw new Error("At least one other member is required");
    }

    const conversation = await conversationRepository.create({
      type: type as any,
      subType: type === "GROUP" ? ((subType || "GENERAL") as any) : undefined,
      name,
      description,
      createdBy: creatorId,
      memberIds: uniqueMembers,
      memberRoles: memberRoles?.map((mr) => ({
        userId: mr.userId,
        role: mr.role as MemberRole,
      })),
      ...groupSettings,
    });

    logger.info("Conversation created via service", {
      conversationId: conversation.id,
      userId: creatorId,
      subType: conversation.subType,
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
   * Permission check based on group type and settings.
   */
  async addMember(
    conversationId: string,
    requesterId: string,
    newMemberId: string,
    role: MemberRole = "MEMBER"
  ): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole) throw new Error("You are not a member of this conversation");

    // Check permission to add members
    const isAdmin = hasAdminAccess(requesterRole, conversation.subType);
    if (conversation.addMembers === "ADMINS_ONLY" && !isAdmin) {
      throw new Error("Only admins can add members to this group");
    }

    // Check member limit
    const memberCount = await conversationRepository.getMemberCount(conversationId);
    if (memberCount >= conversation.maxMembers) {
      throw new Error(`Group has reached its maximum capacity of ${conversation.maxMembers} members`);
    }

    await conversationRepository.addMember(conversationId, newMemberId, role);

    logger.info("Member added to conversation", {
      conversationId,
      userId: newMemberId,
      role,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_JOINED, { conversationId, userId: newMemberId, role });
  }

  /**
   * Remove a member from a group conversation.
   * OWNER can remove anyone. ADMIN can remove MEMBER only.
   * For Care Circles: CAREGIVER can also remove.
   */
  async removeMember(
    conversationId: string,
    requesterId: string,
    targetMemberId: string
  ): Promise<void> {
    const isSelf = requesterId === targetMemberId;

    // Self-removal is always allowed (leaving)
    if (isSelf) {
      // OWNER cannot leave — must transfer ownership first
      const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
      if (requesterRole === "OWNER") {
        throw new Error("Group owner cannot leave. Transfer ownership first or delete the group.");
      }
      await conversationRepository.removeMember(conversationId, targetMemberId);
      broadcastToConversation(conversationId, WS_EVENTS.MEMBER_LEFT, { conversationId, userId: targetMemberId });
      // ADMIN/CAREGIVER just left — make sure the group still has an admin.
      if (requesterRole === "ADMIN" || requesterRole === "CAREGIVER") {
        await this.ensureAdminSuccession(conversationId);
      }
      return;
    }

    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole) throw new Error("You are not a member of this conversation");

    const isAdmin = hasAdminAccess(requesterRole, conversation.subType);
    if (!isAdmin) {
      throw new Error("Only admins can remove members");
    }

    const targetRole = await conversationRepository.getMemberRole(conversationId, targetMemberId);
    if (!targetRole) throw new Error("Target user is not a member");

    if (targetRole === "OWNER") {
      throw new Error("Cannot remove the owner");
    }

    // ADMIN can only remove MEMBER (not other ADMINs)
    if (requesterRole === "ADMIN" && targetRole === "ADMIN") {
      throw new Error("Admins cannot remove other admins");
    }

    await conversationRepository.removeMember(conversationId, targetMemberId);

    logger.info("Member removed from conversation", {
      conversationId,
      userId: targetMemberId,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_REMOVED, { conversationId, userId: targetMemberId });

    // The removed member held an admin-capable role — make sure the group
    // still has an admin left to approve members / moderate chat.
    if (targetRole === "ADMIN" || targetRole === "CAREGIVER") {
      await this.ensureAdminSuccession(conversationId);
    }
  }

  /**
   * Update a member's role.
   * OWNER can promote to ADMIN or assign Care Circle roles.
   * For Care Circles: CAREGIVER can also manage roles.
   */
  async updateMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    newRole: MemberRole
  ): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole) throw new Error("You are not a member of this conversation");

    // Cannot change own role
    if (requesterId === targetUserId) {
      throw new Error("Cannot change your own role");
    }

    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);
    if (!targetRole) throw new Error("Target user is not a member");

    // Cannot change OWNER's role
    if (targetRole === "OWNER") {
      throw new Error("Cannot change the owner's role");
    }

    // Cannot promote to OWNER
    if (newRole === "OWNER") {
      throw new Error("Cannot promote to owner. Use ownership transfer instead.");
    }

    // Permission check
    if (conversation.subType === "CARE_CIRCLE") {
      // Only OWNER or CAREGIVER can manage roles in Care Circle
      if (!CARE_CIRCLE_ADMIN_ROLES.includes(requesterRole)) {
        throw new Error("Only the PwD (owner) or caregiver can manage roles in a Care Circle");
      }
    } else {
      // Only OWNER can promote to ADMIN; ADMIN can demote other ADMINs only if they're OWNER
      if (requesterRole !== "OWNER") {
        throw new Error("Only the group owner can change member roles");
      }
    }

    const adminRoles = adminRolesFor(conversation.subType);
    const targetWasAdmin = adminRoles.includes(targetRole);
    const newRoleIsAdmin = adminRoles.includes(newRole);

    // Promoting to an admin-capable role — enforce the max-3-admin cap.
    if (newRoleIsAdmin && !targetWasAdmin) {
      await this.ensureAdminCapacity(conversationId, conversation.subType);
    }

    // Demoting the group's only remaining admin-capable member would leave
    // it unmanageable — block it, mirroring the existing OWNER protection.
    if (targetWasAdmin && !newRoleIsAdmin) {
      const remainingAdmins = await conversationRepository.countActiveAdmins(conversationId, adminRoles, targetUserId);
      if (remainingAdmins === 0) {
        throw new Error("Cannot demote the group's only remaining admin. Promote another member first.");
      }
    }

    await conversationRepository.updateMemberRole(conversationId, targetUserId, newRole);

    logger.info("Member role updated", {
      conversationId,
      targetUserId,
      oldRole: targetRole,
      newRole,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, { conversationId, userId: targetUserId, role: newRole });
  }

  /**
   * Throws if the group is already at MAX_ADMINS_PER_GROUP admin-capable
   * members. Call before any promotion (manual or automatic) that would add
   * one more.
   */
  async ensureAdminCapacity(conversationId: string, subType: GroupSubType | null): Promise<void> {
    const adminRoles = adminRolesFor(subType);
    const count = await conversationRepository.countActiveAdmins(conversationId, adminRoles);
    if (count >= MAX_ADMINS_PER_GROUP) {
      throw new Error(`This group already has the maximum of ${MAX_ADMINS_PER_GROUP} admins.`);
    }
  }

  /**
   * Makes sure a group always has at least one active, admin-capable member
   * so it never becomes stuck (no one able to approve members, moderate
   * chat, or manage the group). Called whenever an admin-capable member
   * might have just become unavailable — they left, were removed, were
   * deleted, suspended, or banned.
   *
   * `excludeUserId` lets a caller say "treat this specific user as
   * unavailable even though their membership row is still active" — needed
   * for suspension, which (per product decision) does NOT strip group
   * membership, only the ability to act as an admin while suspended.
   *
   * Promotes the earliest-joined eligible member ("the next member added to
   * the group after admin") to the group's admin role (ADMIN for General
   * Groups, CAREGIVER for Care Circles) — never OWNER, which stays a
   * deliberate transfer. No-ops if the group already has an active admin,
   * or if there's no one left to promote.
   */
  async ensureAdminSuccession(
    conversationId: string,
    excludeUserId?: string
  ): Promise<{ userId: string; role: MemberRole } | null> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation || conversation.type !== "GROUP") return null;

    const adminRoles = adminRolesFor(conversation.subType);
    const activeAdmins = await conversationRepository.countActiveAdmins(conversationId, adminRoles, excludeUserId);
    if (activeAdmins > 0) return null;

    // Defensive — shouldn't be reachable since we only get here when the
    // active-admin count just dropped to zero, but never exceed the cap.
    if (activeAdmins >= MAX_ADMINS_PER_GROUP) return null;

    const candidate = await conversationRepository.getEarliestActiveNonAdmin(conversationId, adminRoles, excludeUserId);
    if (!candidate) {
      logger.warn("No eligible member to auto-promote — group has no active admin", { conversationId });
      return null;
    }

    const promoteRole = adminRoleToPromoteTo(conversation.subType);
    await conversationRepository.updateMemberRole(conversationId, candidate.userId, promoteRole);

    logger.info("Auto-promoted member to admin (succession)", {
      conversationId,
      userId: candidate.userId,
      role: promoteRole,
      excludedUserId: excludeUserId,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, {
      conversationId,
      userId: candidate.userId,
      role: promoteRole,
    });

    return { userId: candidate.userId, role: promoteRole };
  }

  /**
   * Update group info (name, description).
   */
  async updateGroupInfo(
    conversationId: string,
    requesterId: string,
    data: { name?: string; description?: string }
  ): Promise<ConversationWithMembers | null> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Cannot edit info for non-group conversations");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole) throw new Error("You are not a member of this conversation");

    const isAdmin = hasAdminAccess(requesterRole, conversation.subType);
    if (conversation.editGroupInfo === "ADMINS_ONLY" && !isAdmin) {
      throw new Error("Only admins can edit group info");
    }

    const updated = await conversationRepository.updateGroupInfo(conversationId, data);
    broadcastToConversation(conversationId, WS_EVENTS.GROUP_INFO_UPDATED, { conversationId, ...data });
    return updated;
  }

  /**
   * Update group permission settings.
   * Only OWNER/ADMIN (or CAREGIVER for Care Circles) can change settings.
   */
  async updateGroupSettings(
    conversationId: string,
    requesterId: string,
    settings: {
      editGroupInfo?: string;
      addMembers?: string;
      sendMessages?: string;
      approveNewMembers?: boolean;
    }
  ): Promise<ConversationWithMembers | null> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Cannot update settings for non-group conversations");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!requesterRole) throw new Error("You are not a member of this conversation");

    const isAdmin = hasAdminAccess(requesterRole, conversation.subType);
    if (!isAdmin) {
      throw new Error("Only admins can change group settings");
    }

    const updated = await conversationRepository.updateSettings(conversationId, settings);
    broadcastToConversation(conversationId, WS_EVENTS.GROUP_SETTINGS_UPDATED, { conversationId, ...settings });
    return updated;
  }

  /**
   * Transfer group ownership to another member.
   * Current owner is demoted to ADMIN; target becomes OWNER.
   */
  async transferOwnership(
    conversationId: string,
    currentOwnerId: string,
    newOwnerId: string
  ): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Ownership transfer is only for groups");

    // Verify requester is the current OWNER
    const currentRole = await conversationRepository.getMemberRole(conversationId, currentOwnerId);
    if (currentRole !== "OWNER") {
      throw new Error("Only the current owner can transfer ownership");
    }

    // Verify target is an active member
    const targetRole = await conversationRepository.getMemberRole(conversationId, newOwnerId);
    if (!targetRole) {
      throw new Error("Target user is not an active member of this group");
    }

    if (currentOwnerId === newOwnerId) {
      throw new Error("Already the owner");
    }

    // Swap roles: current owner → the group's admin role (ADMIN for General
    // Groups, CAREGIVER for Care Circles — never a role with no admin
    // access), target → OWNER. Both writes in one transaction so a failure
    // partway through can never leave the group with zero owners.
    const demotedRole = adminRoleToPromoteTo(conversation.subType);
    await prisma.$transaction([
      prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: currentOwnerId } },
        data: { role: demotedRole },
      }),
      prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: newOwnerId } },
        data: { role: "OWNER" },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { createdBy: newOwnerId },
      }),
    ]);

    logger.info("Ownership transferred", {
      conversationId,
      previousOwner: currentOwnerId,
      newOwner: newOwnerId,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, { conversationId, userId: currentOwnerId, role: demotedRole });
    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, { conversationId, userId: newOwnerId, role: "OWNER" });
  }

  /**
   * Delete a group (soft-delete). Only the OWNER may delete.
   * Broadcasts GROUP_DELETED to all members before removing.
   */
  async deleteGroup(conversationId: string, requesterId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Only groups can be deleted");

    const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (requesterRole !== "OWNER") {
      throw new Error("Only the group owner can delete this group");
    }

    await this.softDeleteAndNotify(conversationId, requesterId);
  }

  /**
   * Admin-initiated deletion — bypasses the owner check since this is called
   * from the moderation panel, not a group member. Same broadcast behavior
   * as a normal deletion so members' clients react in real time either way.
   */
  async adminDeleteGroup(conversationId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Only groups can be deleted");

    await this.softDeleteAndNotify(conversationId, "admin");
  }

  /**
   * Admin-initiated ownership transfer — the moderation panel isn't a group
   * member, so this skips the "requester must already be the owner" check
   * that the member-initiated transferOwnership() enforces, but keeps every
   * other invariant (target must be an active member, single transaction,
   * WS broadcast, createdBy updated). Lets a Super Admin reassign a group's
   * admin/owner directly.
   */
  async adminTransferOwnership(conversationId: string, newOwnerId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Ownership transfer is only for groups");

    const targetRole = await conversationRepository.getMemberRole(conversationId, newOwnerId);
    if (!targetRole) throw new Error("Target user is not an active member of this group");

    const currentOwner = conversation.members.find((m) => m.role === "OWNER");

    if (currentOwner?.userId === newOwnerId) {
      throw new Error("Already the owner");
    }

    const demotedRole = adminRoleToPromoteTo(conversation.subType);
    const writes = [
      prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: newOwnerId } },
        data: { role: "OWNER" },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: { createdBy: newOwnerId },
      }),
      ...(currentOwner
        ? [
            prisma.conversationMember.update({
              where: { conversationId_userId: { conversationId, userId: currentOwner.userId } },
              data: { role: demotedRole },
            }),
          ]
        : []),
    ];
    await prisma.$transaction(writes);

    logger.info("Ownership transferred by admin", {
      conversationId,
      previousOwner: currentOwner?.userId ?? null,
      newOwner: newOwnerId,
    });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, { conversationId, userId: newOwnerId, role: "OWNER" });
    if (currentOwner) {
      broadcastToConversation(conversationId, WS_EVENTS.MEMBER_ROLE_UPDATED, { conversationId, userId: currentOwner.userId, role: demotedRole });
    }
  }

  /**
   * Admin-privileged member removal — no "requester must be an admin
   * member" check (the caller is the moderation panel, not a group member),
   * but still refuses to remove the OWNER (transfer ownership first) and
   * runs the same succession check as the member-initiated removeMember()
   * if the removed member was admin-capable.
   */
  async adminRemoveMember(conversationId: string, targetUserId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const targetRole = await conversationRepository.getMemberRole(conversationId, targetUserId);
    if (!targetRole) throw new Error("Target user is not a member");

    if (targetRole === "OWNER") {
      throw new Error("Cannot remove the owner. Transfer ownership first.");
    }

    await conversationRepository.removeMember(conversationId, targetUserId);

    logger.info("Member removed by admin", { conversationId, userId: targetUserId });

    broadcastToConversation(conversationId, WS_EVENTS.MEMBER_REMOVED, { conversationId, userId: targetUserId });

    if (targetRole === "ADMIN" || targetRole === "CAREGIVER") {
      await this.ensureAdminSuccession(conversationId);
    }
  }

  private async softDeleteAndNotify(conversationId: string, deletedBy: string): Promise<void> {
    // Capture member IDs BEFORE deletion so we can notify everyone
    const memberIds = await conversationRepository.getMemberIds(conversationId);

    await conversationRepository.softDeleteConversation(conversationId);

    const envelope = { event: WS_EVENTS.GROUP_DELETED, data: { conversationId }, timestamp: Date.now() };
    for (const memberId of memberIds) {
      connectionManager.sendToUser(memberId, envelope);
    }

    logger.info("Group deleted", { conversationId, deletedBy });
  }

  async muteConversation(conversationId: string, userId: string, muted: boolean): Promise<void> {
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) throw new Error("You are not a member of this conversation");
    await conversationRepository.muteConversation(conversationId, userId, muted);
  }

  async pinConversation(conversationId: string, userId: string, pinned: boolean): Promise<void> {
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) throw new Error("You are not a member of this conversation");
    await conversationRepository.pinConversation(conversationId, userId, pinned);
  }
}

export const conversationService = new ConversationService();

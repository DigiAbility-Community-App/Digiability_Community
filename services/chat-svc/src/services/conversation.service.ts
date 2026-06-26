// ─────────────────────────────────────────────────────────────
// Conversation Service
//
// Business logic layer for conversation operations.
// Orchestrates between repository and validation.
// ─────────────────────────────────────────────────────────────

import { conversationRepository, CreateConversationInput, ConversationWithMembers } from "../repositories/conversation.repository";
import { MemberRole, ConversationType, GroupSubType } from "../generated/client";
import { logger } from "../config/logger";

// Roles that have admin-level access in Care Circles
const CARE_CIRCLE_ADMIN_ROLES: MemberRole[] = ["OWNER", "CAREGIVER"];
// Roles that have admin-level access in General Groups
const GROUP_ADMIN_ROLES: MemberRole[] = ["OWNER", "ADMIN"];

/**
 * Check if a role has admin-level permissions.
 * For Care Circles: OWNER and CAREGIVER have admin access.
 * For General Groups: OWNER and ADMIN have admin access.
 */
function hasAdminAccess(role: MemberRole, subType?: GroupSubType | null): boolean {
  if (subType === "CARE_CIRCLE") {
    return CARE_CIRCLE_ADMIN_ROLES.includes(role);
  }
  return GROUP_ADMIN_ROLES.includes(role);
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
    memberRoles?: Array<{ userId: string; role: string }>
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

    // For self-conversations, pass empty uniqueMembers — repository handles it
    const uniqueMembers = isSelfConversation
      ? [] // creator-only conversation
      : [...new Set(memberIds.filter((id) => id !== creatorId))];

    // DIRECT conversations need a recipient; GROUPs can start with just the creator
    if (type === "DIRECT" && !isSelfConversation && uniqueMembers.length === 0) {
      throw new Error("At least one other member is required for a direct conversation");
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
    // Self-removal is always allowed (leaving)
    if (requesterId === targetMemberId) {
      // OWNER cannot leave — must transfer ownership first
      const requesterRole = await conversationRepository.getMemberRole(conversationId, requesterId);
      if (requesterRole === "OWNER") {
        throw new Error("Group owner cannot leave. Transfer ownership first or delete the group.");
      }
      await conversationRepository.removeMember(conversationId, targetMemberId);
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

    await conversationRepository.updateMemberRole(conversationId, targetUserId, newRole);

    logger.info("Member role updated", {
      conversationId,
      targetUserId,
      oldRole: targetRole,
      newRole,
    });
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

    return conversationRepository.updateGroupInfo(conversationId, data);
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

    return conversationRepository.updateSettings(conversationId, settings);
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

    // Swap roles: current owner → ADMIN, target → OWNER
    await conversationRepository.updateMemberRole(conversationId, currentOwnerId, "ADMIN");
    await conversationRepository.updateMemberRole(conversationId, newOwnerId, "OWNER");

    logger.info("Ownership transferred", {
      conversationId,
      previousOwner: currentOwnerId,
      newOwner: newOwnerId,
    });
  }
}

export const conversationService = new ConversationService();

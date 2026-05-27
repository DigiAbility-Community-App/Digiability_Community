// ─────────────────────────────────────────────────────────────
// Invite Service
//
// Business logic for group/care-circle invitations.
// Handles permission checks, invite lifecycle, and member
// addition on accept.
// ─────────────────────────────────────────────────────────────

import { inviteRepository } from "../repositories/invite.repository";
import { conversationRepository } from "../repositories/conversation.repository";
import { MemberRole, GroupSubType } from "../generated/client";
import { logger } from "../config/logger";
import { connectionManager } from "../websocket/connection-manager";
import { WS_EVENTS } from "../types/ws-events";

const INVITE_EXPIRY_DAYS = 7;

// Roles with admin-level access per group type
const CARE_CIRCLE_ADMIN_ROLES: MemberRole[] = ["OWNER", "CAREGIVER"];
const GROUP_ADMIN_ROLES: MemberRole[] = ["OWNER", "ADMIN"];

function hasAdminAccess(role: MemberRole, subType?: GroupSubType | null): boolean {
  if (subType === "CARE_CIRCLE") {
    return CARE_CIRCLE_ADMIN_ROLES.includes(role);
  }
  return GROUP_ADMIN_ROLES.includes(role);
}

class InviteService {
  /**
   * Send an invitation to join a group/care-circle.
   */
  async sendInvite(
    conversationId: string,
    inviterId: string,
    inviteeId: string,
    role: MemberRole = "MEMBER",
    message?: string
  ) {
    // 1. Get conversation details
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Invites are only for group conversations");

    // 2. Check inviter is a member with permission to add
    const inviterRole = await conversationRepository.getMemberRole(conversationId, inviterId);
    if (!inviterRole) throw new Error("You are not a member of this group");

    const isAdmin = hasAdminAccess(inviterRole, conversation.subType);
    if (conversation.addMembers === "ADMINS_ONLY" && !isAdmin) {
      throw new Error("Only admins can invite members to this group");
    }

    // 3. Check invitee isn't already a member
    const isAlreadyMember = await conversationRepository.isMember(conversationId, inviteeId);
    if (isAlreadyMember) throw new Error("User is already a member of this group");

    // 4. Check no duplicate pending invite
    const existingInvite = await inviteRepository.findPendingInvite(conversationId, inviteeId);
    if (existingInvite) throw new Error("A pending invite already exists for this user");

    // 5. Check member limit
    const memberCount = await conversationRepository.getMemberCount(conversationId);
    if (memberCount >= conversation.maxMembers) {
      throw new Error(`Group has reached its maximum capacity of ${conversation.maxMembers} members`);
    }

    // 6. Validate role for Care Circle
    if (conversation.subType === "CARE_CIRCLE") {
      const validRoles: MemberRole[] = ["MEMBER", "CAREGIVER", "MENTOR", "PROFESSIONAL"];
      if (!validRoles.includes(role)) {
        throw new Error(`Invalid Care Circle role: ${role}`);
      }
    } else {
      // General group: only MEMBER or ADMIN
      if (!["MEMBER", "ADMIN"].includes(role)) {
        throw new Error(`Invalid group role: ${role}. Use MEMBER or ADMIN.`);
      }
    }

    // 7. Create invite
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invite = await inviteRepository.create({
      conversationId,
      inviterId,
      inviteeId,
      role,
      message,
      expiresAt,
    });

    // 8. Send real-time notification to invitee
    this.notifyUser(inviteeId, WS_EVENTS.INVITE_NEW, {
      inviteId: invite.id,
      conversationId,
      groupName: conversation.name,
      subType: conversation.subType,
      inviterId,
      role,
      message,
      expiresAt: expiresAt.toISOString(),
    });

    logger.info("Invite sent", {
      inviteId: invite.id,
      conversationId,
      inviterId,
      inviteeId,
      role,
    });

    return invite;
  }

  /**
   * Respond to an invitation (accept or decline).
   */
  async respondToInvite(
    inviteId: string,
    inviteeId: string,
    action: "accept" | "decline"
  ) {
    // 1. Fetch invite
    const invite = await inviteRepository.findById(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.inviteeId !== inviteeId) throw new Error("This invite is not for you");
    if (invite.status !== "PENDING") throw new Error(`Invite has already been ${invite.status.toLowerCase()}`);

    // 2. Check expiry
    if (new Date() > invite.expiresAt) {
      await inviteRepository.updateStatus(inviteId, "EXPIRED");
      throw new Error("This invite has expired");
    }

    if (action === "accept") {
      // 3a. Check member limit again
      const memberCount = await conversationRepository.getMemberCount(invite.conversationId);
      const conversation = await conversationRepository.getById(invite.conversationId);
      if (conversation && memberCount >= conversation.maxMembers) {
        throw new Error("Group has reached its maximum capacity");
      }

      // 4a. Add member with the assigned role
      await conversationRepository.addMember(invite.conversationId, inviteeId, invite.role);
      await inviteRepository.updateStatus(inviteId, "ACCEPTED");

      // 5a. Notify group members
      const memberIds = await conversationRepository.getMemberIds(invite.conversationId);
      for (const memberId of memberIds) {
        this.notifyUser(memberId, WS_EVENTS.MEMBER_JOINED, {
          conversationId: invite.conversationId,
          userId: inviteeId,
          role: invite.role,
        });
      }

      // 6a. Notify inviter specifically
      this.notifyUser(invite.inviterId, WS_EVENTS.INVITE_ACCEPTED, {
        inviteId,
        conversationId: invite.conversationId,
        inviteeId,
      });

      logger.info("Invite accepted", { inviteId, inviteeId, conversationId: invite.conversationId });
    } else {
      // 3b. Decline
      await inviteRepository.updateStatus(inviteId, "DECLINED");

      // 4b. Notify inviter
      this.notifyUser(invite.inviterId, WS_EVENTS.INVITE_DECLINED, {
        inviteId,
        conversationId: invite.conversationId,
        inviteeId,
      });

      logger.info("Invite declined", { inviteId, inviteeId });
    }

    return inviteRepository.findById(inviteId);
  }

  /**
   * Cancel a pending invite (by inviter or group admin).
   */
  async cancelInvite(inviteId: string, requesterId: string) {
    const invite = await inviteRepository.findById(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "PENDING") throw new Error("Only pending invites can be cancelled");

    // Permission check: inviter or group admin
    if (invite.inviterId !== requesterId) {
      const conversation = await conversationRepository.getById(invite.conversationId);
      const role = await conversationRepository.getMemberRole(invite.conversationId, requesterId);
      if (!role || !hasAdminAccess(role, conversation?.subType)) {
        throw new Error("Only the inviter or a group admin can cancel this invite");
      }
    }

    await inviteRepository.updateStatus(inviteId, "CANCELLED");

    // Notify invitee
    this.notifyUser(invite.inviteeId, WS_EVENTS.INVITE_CANCELLED, {
      inviteId,
      conversationId: invite.conversationId,
    });

    logger.info("Invite cancelled", { inviteId, requesterId });
  }

  /**
   * List pending invites for the current user.
   */
  async listPendingInvites(userId: string) {
    // Expire overdue invites first
    await inviteRepository.expireOverdueInvites();
    return inviteRepository.findPendingByUser(userId);
  }

  /**
   * Count pending invites for a user (for badge).
   */
  async countPendingInvites(userId: string): Promise<number> {
    return inviteRepository.countPendingByUser(userId);
  }

  /**
   * List all invites for a conversation (admin view).
   */
  async listGroupInvites(conversationId: string, requesterId: string) {
    const role = await conversationRepository.getMemberRole(conversationId, requesterId);
    if (!role) throw new Error("You are not a member of this group");

    const conversation = await conversationRepository.getById(conversationId);
    const isAdmin = hasAdminAccess(role, conversation?.subType);
    if (!isAdmin) throw new Error("Only admins can view group invites");

    return inviteRepository.findByConversation(conversationId);
  }

  /**
   * Send a real-time WebSocket notification to a user.
   */
  private notifyUser(userId: string, event: string, data: any) {
    try {
      connectionManager.sendToUser(userId, {
        event,
        data,
        timestamp: Date.now(),
      });
    } catch {
      // Non-fatal: user may be offline
    }
  }
}

export const inviteService = new InviteService();

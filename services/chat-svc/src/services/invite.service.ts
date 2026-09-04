// ─────────────────────────────────────────────────────────────
// Invite Service
//
// Business logic for group/care-circle invitations.
// Handles permission checks, invite lifecycle, and member
// addition on accept.
// ─────────────────────────────────────────────────────────────

import { inviteRepository } from "../repositories/invite.repository";
import { conversationRepository } from "../repositories/conversation.repository";
import { conversationService } from "./conversation.service";
import { MemberRole, GroupSubType } from "../generated/client";
import { logger } from "../config/logger";
import { connectionManager } from "../websocket/connection-manager";
import { WS_EVENTS } from "../types/ws-events";
import { createError } from "../middleware/error.middleware";
import { hasAdminAccess, adminRolesFor } from "../utils/roles.util";

const INVITE_EXPIRY_DAYS = 7;

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
   * Self-serve join a discoverable group (mobile "Join" button on a public
   * group listing) — distinct from sendInvite/respondToInvite, where an
   * existing member invites someone specific. Mirrors respondToInvite's
   * accept branch: check limit, then gate on approveNewMembers.
   */
  async requestToJoin(conversationId: string, userId: string) {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (conversation.type !== "GROUP") throw new Error("Not a group conversation");

    // 1. Already a member — idempotent, matches the prior joinGroup behavior.
    const alreadyMember = await conversationRepository.isMember(conversationId, userId);
    if (alreadyMember) {
      return { status: "joined" as const };
    }

    // 2. A request is already outstanding — don't create a duplicate invite
    // row on a repeat tap of "Join".
    const existing = await inviteRepository.findActiveJoinRequest(conversationId, userId);
    if (existing) {
      return existing.status === "AWAITING_APPROVAL"
        ? { status: "pending_approval" as const, inviteId: existing.id }
        : { status: "joined" as const }; // PENDING self-request would only reach here mid-race; treat as in-flight
    }

    // 3. Member limit — checked before queuing a request too, so a full
    // group doesn't accumulate pending approvals it can never honor.
    const memberCount = await conversationRepository.getMemberCount(conversationId);
    if (memberCount >= conversation.maxMembers) {
      throw createError(`Group has reached its maximum capacity of ${conversation.maxMembers} members`, 400);
    }

    // 4. WhatsApp-style: require admin approval instead of joining directly.
    if (conversation.approveNewMembers) {
      const invite = await inviteRepository.create({
        conversationId,
        inviterId: userId,
        inviteeId: userId,
        role: "MEMBER",
        expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        status: "AWAITING_APPROVAL",
      });

      const admins = await this.getAdminMembers(conversationId, conversation.subType);
      for (const adminId of admins) {
        this.notifyUser(adminId, "member.join_request" as any, {
          inviteId: invite.id,
          conversationId,
          groupName: conversation.name,
          userId,
          requestedRole: "MEMBER",
        });
      }

      logger.info("Join request awaiting admin approval", { conversationId, userId, inviteId: invite.id });

      return { status: "pending_approval" as const, inviteId: invite.id };
    }

    // 5. No approval required — join directly.
    await conversationRepository.addMember(conversationId, userId, "MEMBER");

    const memberIds = await conversationRepository.getMemberIds(conversationId);
    for (const memberId of memberIds) {
      this.notifyUser(memberId, WS_EVENTS.MEMBER_JOINED, { conversationId, userId, role: "MEMBER" });
    }

    logger.info("User joined group directly", { conversationId, userId });

    return { status: "joined" as const };
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

      // 3b. WhatsApp-style: if approveNewMembers is enabled, queue for admin approval
      if (conversation && conversation.approveNewMembers) {
        // Check if the invitee would be an admin (admins bypass approval)
        const inviteeIsAdmin = conversation.subType === "CARE_CIRCLE"
          ? (invite.role === "OWNER" || invite.role === "CAREGIVER")
          : (invite.role === "OWNER" || invite.role === "ADMIN");

        if (!inviteeIsAdmin) {
          // Mark invite as awaiting approval instead of directly adding
          await inviteRepository.updateStatus(inviteId, "AWAITING_APPROVAL");

          // Notify all admins about the join request
          const members = await this.getAdminMembers(invite.conversationId, conversation.subType);
          for (const adminId of members) {
            this.notifyUser(adminId, "member.join_request" as any, {
              inviteId,
              conversationId: invite.conversationId,
              groupName: conversation.name,
              userId: inviteeId,
              requestedRole: invite.role,
            });
          }

          logger.info("Invite accepted but awaiting admin approval", {
            inviteId, inviteeId, conversationId: invite.conversationId,
          });

          return inviteRepository.findById(inviteId);
        }
      }

      // 4a. Add member with the assigned role — enforce the max-3-admin cap
      // if this invite carries an admin-capable role.
      if (conversation && adminRolesFor(conversation.subType).includes(invite.role)) {
        await conversationService.ensureAdminCapacity(invite.conversationId, conversation.subType);
      }
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
   * Approve or reject a join request (admin action).
   * Only available when approveNewMembers is enabled.
   */
  async approveJoinRequest(
    inviteId: string,
    adminId: string,
    approve: boolean
  ) {
    // 1. Fetch invite
    const invite = await inviteRepository.findById(inviteId);
    if (!invite) throw new Error("Invite not found");
    if (invite.status !== "AWAITING_APPROVAL") {
      throw new Error("This invite is not awaiting approval");
    }

    // 2. Verify admin permission
    const conversation = await conversationRepository.getById(invite.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const adminRole = await conversationRepository.getMemberRole(invite.conversationId, adminId);
    if (!adminRole || !hasAdminAccess(adminRole, conversation.subType)) {
      throw new Error("Only admins can approve join requests");
    }

    if (approve) {
      // Check member limit
      const memberCount = await conversationRepository.getMemberCount(invite.conversationId);
      if (memberCount >= conversation.maxMembers) {
        throw new Error("Group has reached its maximum capacity");
      }

      // Add member — enforce the max-3-admin cap if this invite carries an
      // admin-capable role.
      if (adminRolesFor(conversation.subType).includes(invite.role)) {
        await conversationService.ensureAdminCapacity(invite.conversationId, conversation.subType);
      }
      await conversationRepository.addMember(invite.conversationId, invite.inviteeId, invite.role);
      await inviteRepository.updateStatus(inviteId, "ACCEPTED");

      // Notify group members
      const memberIds = await conversationRepository.getMemberIds(invite.conversationId);
      for (const memberId of memberIds) {
        this.notifyUser(memberId, WS_EVENTS.MEMBER_JOINED, {
          conversationId: invite.conversationId,
          userId: invite.inviteeId,
          role: invite.role,
        });
      }

      // Notify the approved user
      this.notifyUser(invite.inviteeId, WS_EVENTS.INVITE_ACCEPTED, {
        inviteId,
        conversationId: invite.conversationId,
        message: "Your join request has been approved",
      });

      logger.info("Join request approved", { inviteId, adminId, inviteeId: invite.inviteeId });
    } else {
      await inviteRepository.updateStatus(inviteId, "DECLINED");

      // Notify the rejected user
      this.notifyUser(invite.inviteeId, WS_EVENTS.INVITE_DECLINED, {
        inviteId,
        conversationId: invite.conversationId,
        message: "Your join request has been declined",
      });

      logger.info("Join request rejected", { inviteId, adminId, inviteeId: invite.inviteeId });
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
   * Get all admin member IDs for a conversation.
   */
  private async getAdminMembers(
    conversationId: string,
    subType?: string | null
  ): Promise<string[]> {
    const members = await conversationRepository.getMemberIds(conversationId);
    const adminIds: string[] = [];

    for (const memberId of members) {
      const role = await conversationRepository.getMemberRole(conversationId, memberId);
      if (role && hasAdminAccess(role, subType as any)) {
        adminIds.push(memberId);
      }
    }

    return adminIds;
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

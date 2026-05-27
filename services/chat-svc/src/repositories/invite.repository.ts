// ─────────────────────────────────────────────────────────────
// Invite Repository
//
// Database operations for the GroupInvite model.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { Prisma, InviteStatus, MemberRole, ConversationType, GroupSubType } from "../generated/client";

export interface InviteWithConversation {
  id: string;
  conversationId: string;
  inviterId: string;
  inviteeId: string;
  role: MemberRole;
  message: string | null;
  status: InviteStatus;
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  conversation: {
    id: string;
    name: string | null;
    subType: string | null;
    type: string;
  };
}

class InviteRepository {
  /**
   * Create a new group invite.
   */
  async create(data: {
    conversationId: string;
    inviterId: string;
    inviteeId: string;
    role?: MemberRole;
    message?: string;
    expiresAt: Date;
  }): Promise<InviteWithConversation> {
    return prisma.groupInvite.create({
      data: {
        conversationId: data.conversationId,
        inviterId: data.inviterId,
        inviteeId: data.inviteeId,
        role: data.role || "MEMBER",
        message: data.message,
        expiresAt: data.expiresAt,
      },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
    });
  }

  /**
   * Find an invite by ID.
   */
  async findById(inviteId: string): Promise<InviteWithConversation | null> {
    return prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
    });
  }

  /**
   * Find existing pending invite for a user in a conversation.
   */
  async findPendingInvite(
    conversationId: string,
    inviteeId: string
  ): Promise<InviteWithConversation | null> {
    return prisma.groupInvite.findFirst({
      where: {
        conversationId,
        inviteeId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
    });
  }

  /**
   * List all pending invites for a user.
   */
  async findPendingByUser(userId: string): Promise<InviteWithConversation[]> {
    return prisma.groupInvite.findMany({
      where: {
        inviteeId: userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * List all invites for a conversation (admin view).
   */
  async findByConversation(conversationId: string): Promise<InviteWithConversation[]> {
    return prisma.groupInvite.findMany({
      where: { conversationId },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update invite status.
   */
  async updateStatus(
    inviteId: string,
    status: InviteStatus,
    respondedAt?: Date
  ): Promise<InviteWithConversation> {
    return prisma.groupInvite.update({
      where: { id: inviteId },
      data: {
        status,
        respondedAt: respondedAt || (status !== "PENDING" ? new Date() : undefined),
      },
      include: {
        conversation: {
          select: { id: true, name: true, subType: true, type: true },
        },
      },
    });
  }

  /**
   * Expire all overdue pending invites.
   */
  async expireOverdueInvites(): Promise<number> {
    const result = await prisma.groupInvite.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date() },
      },
      data: { status: "EXPIRED" },
    });
    return result.count;
  }

  /**
   * Count pending invites for a user.
   */
  async countPendingByUser(userId: string): Promise<number> {
    return prisma.groupInvite.count({
      where: {
        inviteeId: userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });
  }
}

export const inviteRepository = new InviteRepository();

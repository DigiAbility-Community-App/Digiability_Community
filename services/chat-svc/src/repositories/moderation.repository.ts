// ─────────────────────────────────────────────────────────────
// Moderation Repository
// Block/unblock users and file reports. Only layer touching Prisma
// for the moderation domain.
// ─────────────────────────────────────────────────────────────

import prisma from "../models/prisma.client";

class ModerationRepository {
  async block(blockerId: string, blockedId: string): Promise<void> {
    await prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
  }

  async listBlockedIds(blockerId: string): Promise<string[]> {
    const rows = await prisma.blockedUser.findMany({
      where: { blockerId },
      select: { blockedId: true },
    });
    return rows.map((r) => r.blockedId);
  }

  // True if either user has blocked the other.
  async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const row = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  /** Looks up a message's content + sequence for snapshotting into a report. */
  async getMessageSnapshot(messageId: string) {
    return prisma.message.findUnique({
      where: { id: messageId },
      select: { content: true, sequenceNo: true },
    });
  }

  async createReport(data: {
    reporterId: string;
    reportedUserId: string;
    conversationId?: string;
    messageId?: string;
    messageContent?: string;
    messageSequence?: bigint;
    reason: string;
  }) {
    return prisma.report.create({ data });
  }

  /** Whether this reporter has already filed a report against this exact message. */
  async findExistingReport(reporterId: string, messageId: string) {
    return prisma.report.findFirst({
      where: { reporterId, messageId },
      select: { id: true },
    });
  }

  /** Message ids the given user has reported within a conversation — used to
   * mark the "Reported" indicator on the reporter's own view after reopening
   * the chat. */
  async listReportedMessageIds(reporterId: string, conversationId: string): Promise<string[]> {
    const rows = await prisma.report.findMany({
      where: { reporterId, conversationId, messageId: { not: null } },
      select: { messageId: true },
    });
    return rows.map((r) => r.messageId as string);
  }

  /**
   * A small window of messages around a given sequence number, for admins
   * reviewing a specific report to see the surrounding conversation. Returns
   * an empty array if the conversation/messages no longer exist.
   */
  async getSurroundingMessages(conversationId: string, sequenceNo: bigint, radius = 5) {
    return prisma.message.findMany({
      where: {
        conversationId,
        sequenceNo: { gte: sequenceNo - BigInt(radius), lte: sequenceNo + BigInt(radius) },
      },
      orderBy: { sequenceNo: "asc" },
      select: {
        id: true,
        senderId: true,
        content: true,
        type: true,
        sequenceNo: true,
        createdAt: true,
        deletedAt: true,
      },
    });
  }
}

export const moderationRepository = new ModerationRepository();

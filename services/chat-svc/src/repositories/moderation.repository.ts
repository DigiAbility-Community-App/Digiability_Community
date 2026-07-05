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

  async createReport(data: {
    reporterId: string;
    reportedUserId: string;
    conversationId?: string;
    messageId?: string;
    reason: string;
  }) {
    return prisma.report.create({ data });
  }
}

export const moderationRepository = new ModerationRepository();

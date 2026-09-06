// ─────────────────────────────────────────────────────────────
// Moderation Controller
// Block/unblock users, list blocks, and file reports.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";
import { moderationRepository } from "../repositories/moderation.repository";

export const blockUser = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as AuthenticatedRequest).user.sub;
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ success: false, message: "userId is required" });
    return;
  }
  if (userId === me) {
    res.status(400).json({ success: false, message: "You cannot block yourself" });
    return;
  }
  await moderationRepository.block(me, userId);
  res.status(200).json({ success: true, message: "User blocked" });
});

export const unblockUser = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as AuthenticatedRequest).user.sub;
  const { userId } = req.params;
  await moderationRepository.unblock(me, userId);
  res.status(200).json({ success: true, message: "User unblocked" });
});

export const listBlocked = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as AuthenticatedRequest).user.sub;
  const blockedIds = await moderationRepository.listBlockedIds(me);
  res.status(200).json({ success: true, data: { blockedIds } });
});

export const reportUser = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as AuthenticatedRequest).user.sub;
  const { reportedUserId, conversationId, messageId, reason } = req.body as {
    reportedUserId?: string;
    conversationId?: string;
    messageId?: string;
    reason?: string;
  };
  if (!reportedUserId || !reason?.trim()) {
    res.status(400).json({ success: false, message: "reportedUserId and reason are required" });
    return;
  }

  // Super Admin / Platform Admin messages and accounts cannot be reported
  if (
    reportedUserId === "admin" ||
    reportedUserId === "digiability-admin" ||
    reportedUserId === "system"
  ) {
    res.status(400).json({
      success: false,
      message: "Administrator messages and accounts cannot be reported.",
    });
    return;
  }

  // Idempotent re-submission — a user reporting the same message twice (e.g.
  // a double-tap, or the "Report" option briefly still visible before the
  // client re-renders) shouldn't create a second report row.
  if (messageId) {
    const existing = await moderationRepository.findExistingReport(me, messageId);
    if (existing) {
      res.status(200).json({ success: true, data: { reportId: existing.id } });
      return;
    }
  }

  // Snapshot the message content at report time so the evidence an admin
  // reviews survives even if the message is later edited or deleted.
  let messageContent: string | undefined;
  let messageSequence: bigint | undefined;
  if (messageId) {
    const snapshot = await moderationRepository.getMessageSnapshot(messageId);
    if (snapshot) {
      messageContent = snapshot.content;
      messageSequence = snapshot.sequenceNo;
    }
  }

  const report = await moderationRepository.createReport({
    reporterId: me,
    reportedUserId,
    conversationId,
    messageId,
    messageContent,
    messageSequence,
    reason: reason.trim(),
  });
  res.status(201).json({ success: true, data: { reportId: report.id } });
});

export const listMyReportedMessages = asyncHandler(async (req: Request, res: Response) => {
  const me = (req as AuthenticatedRequest).user.sub;
  const { conversationId } = req.query as { conversationId?: string };
  if (!conversationId) {
    res.status(400).json({ success: false, message: "conversationId is required" });
    return;
  }
  const messageIds = await moderationRepository.listReportedMessageIds(me, conversationId);
  res.status(200).json({ success: true, data: { messageIds } });
});

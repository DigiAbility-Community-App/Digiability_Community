// ─────────────────────────────────────────────────────────────
// Message Controller
// REST endpoints for message history, missed messages, and receipts.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { messageService } from "../services/message.service";
import { messageRepository } from "../repositories/message.repository";
import { messageHistoryQuerySchema, missedMessagesQuerySchema } from "../utils/validation.util";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";

export const getMessageHistory = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const parsed = messageHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: parsed.error.issues,
    });
    return;
  }

  const { limit, before } = parsed.data;

  try {
    const result = await messageService.getHistory(
      conversationId,
      user.sub,
      limit,
      before
    );

    res.status(200).json({
      success: true,
      data: result.messages,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Not a member")) {
      res.status(403).json({ success: false, message: err.message });
      return;
    }
    throw err;
  }
});

export const getMissedMessages = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const parsed = missedMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: parsed.error.issues,
    });
    return;
  }

  const { lastSequenceNo, limit } = parsed.data;

  try {
    const result = await messageService.getMissedMessages(
      conversationId,
      user.sub,
      lastSequenceNo,
      limit
    );

    res.status(200).json({
      success: true,
      data: result.messages,
      pagination: {
        hasMore: result.hasMore,
        nextCursor: result.nextCursor,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Not a member")) {
      res.status(403).json({ success: false, message: err.message });
      return;
    }
    throw err;
  }
});

export const markDelivered = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { messageId } = req.params;

  const result = await messageRepository.markDelivered(messageId, user.sub);

  if (!result) {
    res.status(404).json({
      success: false,
      message: "Message not found or you are not a recipient",
    });
    return;
  }

  await messageRepository.createReceipt(messageId, user.sub, "DELIVERED");

  res.status(200).json({
    success: true,
    message: "Marked as delivered",
  });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { messageId } = req.params;
  const { conversationId } = req.body;

  if (!conversationId) {
    res.status(400).json({ success: false, message: "conversationId is required" });
    return;
  }

  const result = await messageRepository.markRead(messageId, user.sub);

  if (!result) {
    res.status(404).json({
      success: false,
      message: "Message not found or you are not a recipient",
    });
    return;
  }

  await messageRepository.createReceipt(messageId, user.sub, "READ");
  await messageRepository.updateReadCursor(conversationId, user.sub, result.sequenceNo);

  res.status(200).json({
    success: true,
    message: "Marked as read",
  });
});

export const getUnreadCounts = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  const counts = await messageService.getUnreadCounts(user.sub);

  res.status(200).json({
    success: true,
    data: counts,
  });
});

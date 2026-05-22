// ─────────────────────────────────────────────────────────────
// Conversation Controller
// REST endpoints for conversation CRUD operations.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { conversationService } from "../services/conversation.service";
import { createConversationSchema } from "../utils/validation.util";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.issues,
    });
    return;
  }

  const { type, name, memberIds } = parsed.data;

  const conversation = await conversationService.createConversation(
    user.sub,
    type,
    memberIds,
    name
  );

  res.status(201).json({
    success: true,
    data: conversation,
  });
});

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  const result = await conversationService.listConversations(user.sub, limit, cursor);

  res.status(200).json({
    success: true,
    data: result.conversations,
    pagination: {
      hasMore: result.hasMore,
      nextCursor: result.hasMore && result.conversations.length > 0
        ? result.conversations[result.conversations.length - 1].id
        : undefined,
    },
  });
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const conversation = await conversationService.getConversation(conversationId, user.sub);

  if (!conversation) {
    res.status(404).json({
      success: false,
      message: "Conversation not found or you are not a member",
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;
  const { userId: newMemberId } = req.body;

  if (!newMemberId) {
    res.status(400).json({ success: false, message: "userId is required" });
    return;
  }

  await conversationService.addMember(conversationId, user.sub, newMemberId);

  res.status(200).json({
    success: true,
    message: "Member added successfully",
  });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId, userId: targetId } = req.params;

  await conversationService.removeMember(conversationId, user.sub, targetId);

  res.status(200).json({
    success: true,
    message: "Member removed successfully",
  });
});

// ─── POST /conversations/init-bot ─────────────────────
// Ensures a DIRECT conversation exists between the user
// and the global Digiability Bot. Called on app startup.
const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

export const initBot = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  // Don't create bot conversation for the bot itself
  if (user.sub === BOT_USER_ID) {
    res.status(200).json({ success: true, data: null, message: "Bot cannot have a bot conversation" });
    return;
  }

  const conversation = await conversationService.createConversation(
    user.sub,
    "DIRECT",
    [BOT_USER_ID]
  );

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

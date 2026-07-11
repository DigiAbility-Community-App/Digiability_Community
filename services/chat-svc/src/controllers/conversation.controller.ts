// ─────────────────────────────────────────────────────────────
// Conversation Controller
// REST endpoints for conversation CRUD operations.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { conversationService } from "../services/conversation.service";
import {
  createConversationSchema,
  updateGroupInfoSchema,
  updateGroupSettingsSchema,
  updateMemberRoleSchema,
} from "../utils/validation.util";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";
import { conversationRepository } from "../repositories/conversation.repository";

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

  const { type, subType, name, description, memberIds, memberRoles } = parsed.data;

  const conversation = await conversationService.createConversation(
    user.sub,
    type,
    memberIds,
    name,
    subType,
    description,
    memberRoles
  );

  res.status(201).json({
    success: true,
    data: conversation,
  });
});

export const joinGroup = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const conversation = await conversationRepository.getById(conversationId);
  if (!conversation || conversation.type !== "GROUP") {
    res.status(404).json({ success: false, message: "Group not found" });
    return;
  }

  const alreadyMember = await conversationRepository.isMember(conversationId, user.sub);
  if (alreadyMember) {
    res.status(200).json({ success: true, message: "Already a member" });
    return;
  }

  await conversationRepository.addMember(conversationId, user.sub, "MEMBER");
  res.status(200).json({ success: true, message: "Joined group successfully" });
});

export const listAllGroups = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const subType = (req.query.subType as string) === "CARE_CIRCLE" ? "CARE_CIRCLE" : "GENERAL";
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  const { groups, hasMore } = await conversationRepository.listAllGroups(subType, user.sub, limit, cursor);

  res.status(200).json({
    success: true,
    data: groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      subType: g.subType,
      memberCount: g.members.length,
      isMember: g.isMember,
      lastMessageText: g.lastMessageText,
      lastMessageAt: g.lastMessageAt,
      createdAt: g.createdAt,
      avatarUrl: g.avatarUrl,
    })),
    pagination: { hasMore, nextCursor: hasMore && groups.length > 0 ? groups[groups.length - 1].id : undefined },
  });
});

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  const result = await conversationService.listConversations(user.sub, limit, cursor);

  // Fetch unread counts for the user
  const { messageService } = await import("../services/message.service");
  const unreadCounts = await messageService.getUnreadCounts(user.sub);
  const countMap = new Map(unreadCounts.map(c => [c.conversationId, c.unreadCount]));

  // Enrich conversations with unread counts
  const enrichedConversations = result.conversations.map(c => ({
    ...c,
    unreadCount: countMap.get(c.id) || 0,
  }));

  res.status(200).json({
    success: true,
    data: enrichedConversations,
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

export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  await conversationService.deleteGroup(conversationId, user.sub);

  res.status(200).json({
    success: true,
    message: "Group deleted successfully",
  });
});

export const updateGroupInfo = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const parsed = updateGroupInfoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.issues });
    return;
  }

  const result = await conversationService.updateGroupInfo(conversationId, user.sub, parsed.data);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updateGroupSettings = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const parsed = updateGroupSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.issues });
    return;
  }

  const result = await conversationService.updateGroupSettings(conversationId, user.sub, parsed.data);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const updateMemberRole = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId, userId: targetId } = req.params;

  const parsed = updateMemberRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: "Validation failed", errors: parsed.error.issues });
    return;
  }

  await conversationService.updateMemberRole(conversationId, user.sub, targetId, parsed.data.role as any);

  res.status(200).json({
    success: true,
    message: "Member role updated successfully",
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

export const transferOwnership = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;
  const { userId: newOwnerId } = req.body;

  if (!newOwnerId) {
    res.status(400).json({ success: false, message: "userId is required" });
    return;
  }

  await conversationService.transferOwnership(conversationId, user.sub, newOwnerId);

  res.status(200).json({
    success: true,
    message: "Ownership transferred successfully",
  });
});

export const muteConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;
  const { muted } = req.body;

  if (typeof muted !== "boolean") {
    res.status(400).json({ success: false, message: "muted (boolean) is required" });
    return;
  }

  await conversationService.muteConversation(conversationId, user.sub, muted);

  res.status(200).json({
    success: true,
    message: muted ? "Conversation muted" : "Conversation unmuted",
  });
});

export const pinConversation = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;
  const { pinned } = req.body;

  if (typeof pinned !== "boolean") {
    res.status(400).json({ success: false, message: "pinned (boolean) is required" });
    return;
  }

  await conversationService.pinConversation(conversationId, user.sub, pinned);

  res.status(200).json({
    success: true,
    message: pinned ? "Conversation pinned" : "Conversation unpinned",
  });
});

export const approveJoinRequest = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { inviteId } = req.params;
  const { approve } = req.body;

  if (typeof approve !== "boolean") {
    res.status(400).json({ success: false, message: "approve (boolean) is required" });
    return;
  }

  const { inviteService } = await import("../services/invite.service");
  const result = await inviteService.approveJoinRequest(inviteId, user.sub, approve);

  res.status(200).json({
    success: true,
    data: result,
    message: approve ? "Join request approved" : "Join request rejected",
  });
});

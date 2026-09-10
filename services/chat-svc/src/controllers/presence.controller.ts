// ─────────────────────────────────────────────────────────────
// Presence Controller
// REST endpoints for user presence and active sessions.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { presenceService } from "../services/presence.service";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";
import { connectionManager } from "../websocket/connection-manager";
import { conversationRepository } from "../repositories/conversation.repository";

// ─────────────────────────────────────────────────────────────
// Presence is gated on sharing a conversation.
//
// These endpoints previously returned any user's online status and last-seen
// time to any authenticated caller — the bulk one 100 at a time. That is enough
// to build an activity-pattern picture of a stranger, and in a Care Circle
// context it is information about a vulnerable person's daily routine.
//
// Sharing a conversation is the natural boundary: you can already see when
// these people are online in the chat UI, so this exposes nothing new about
// them, while a stranger learns nothing at all.
// ─────────────────────────────────────────────────────────────

export const getPresence = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const me = (req as AuthenticatedRequest).user.sub;

  // Your own presence is always visible to you.
  if (userId !== me) {
    const shared = await conversationRepository.filterToSharedConversationUsers(me, [userId]);
    if (!shared.has(userId)) {
      // 404, not 403: confirming "this user exists but you may not see them"
      // is itself a small disclosure.
      res.status(404).json({ success: false, message: "Not found" });
      return;
    }
  }

  const presence = await presenceService.getPresence(userId);

  res.status(200).json({
    success: true,
    data: presence,
  });
});

export const getBulkPresence = asyncHandler(async (req: Request, res: Response) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    res.status(400).json({ success: false, message: "userIds array is required" });
    return;
  }

  if (userIds.length > 100) {
    res.status(400).json({ success: false, message: "Maximum 100 userIds per request" });
    return;
  }

  // Filter to people the caller shares a conversation with, rather than
  // failing the whole request: a client legitimately asks about a member list
  // that may contain someone who has since left.
  const me = (req as AuthenticatedRequest).user.sub;
  const shared = await conversationRepository.filterToSharedConversationUsers(me, userIds);
  const visible = userIds.filter((id: string) => id === me || shared.has(id));

  const presences = await presenceService.getMultiplePresence(visible);

  res.status(200).json({
    success: true,
    data: presences,
  });
});

export const getActiveSessions = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  // Users can only see their own sessions
  const sessions = await presenceService.getActiveSessions(user.sub);

  res.status(200).json({
    success: true,
    data: sessions,
  });
});

export const getServerStats = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      totalConnections: connectionManager.connectionCount,
      totalUsers: connectionManager.userCount,
    },
  });
});

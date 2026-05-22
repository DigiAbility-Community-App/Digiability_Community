// ─────────────────────────────────────────────────────────────
// Presence Controller
// REST endpoints for user presence and active sessions.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { presenceService } from "../services/presence.service";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";
import { connectionManager } from "../websocket/connection-manager";

export const getPresence = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

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

  const presences = await presenceService.getMultiplePresence(userIds);

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

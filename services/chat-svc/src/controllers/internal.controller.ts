import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { conversationRepository } from "../repositories/conversation.repository";
import { logger } from "../config/logger";

// ─────────────────────────────────────────────────────────────
// Internal Controller
// Endpoints for trusted service-to-service calls only.
// Protected by internalAuth middleware — never call from clients.
// ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/internal/users/:userId/memberships
 * Called by user-svc when a user deletes their account.
 * Soft-removes the user from every conversation they belong to.
 */
export const removeUserMemberships = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ success: false, message: "userId is required." });
    return;
  }

  const count = await conversationRepository.removeAllMemberships(userId);
  logger.info("Removed user memberships on account deletion", { userId, count });

  res.status(200).json({ success: true, data: { removedCount: count } });
});

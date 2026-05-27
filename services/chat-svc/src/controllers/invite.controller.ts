// ─────────────────────────────────────────────────────────────
// Invite Controller
// REST endpoints for group invitation operations.
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { inviteService } from "../services/invite.service";
import { sendInviteSchema, respondInviteSchema } from "../utils/validation.util";
import { asyncHandler } from "../middleware/error.middleware";
import { AuthenticatedRequest } from "../types/common.types";

/**
 * POST /api/invites/send — Send a group invite.
 */
export const sendInvite = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  const parsed = sendInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.issues,
    });
    return;
  }

  const { conversationId, userId, role, message } = parsed.data;

  const invite = await inviteService.sendInvite(
    conversationId,
    user.sub,
    userId,
    role as any,
    message
  );

  res.status(201).json({
    success: true,
    data: invite,
  });
});

/**
 * POST /api/invites/:inviteId/respond — Accept or decline an invite.
 */
export const respondToInvite = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { inviteId } = req.params;

  const parsed = respondInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: parsed.error.issues,
    });
    return;
  }

  const result = await inviteService.respondToInvite(inviteId, user.sub, parsed.data.action);

  res.status(200).json({
    success: true,
    data: result,
    message: `Invite ${parsed.data.action}ed successfully`,
  });
});

/**
 * GET /api/invites/pending — List current user's pending invites.
 */
export const listPendingInvites = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  const invites = await inviteService.listPendingInvites(user.sub);

  res.status(200).json({
    success: true,
    data: invites,
    count: invites.length,
  });
});

/**
 * GET /api/invites/count — Count pending invites (for badge).
 */
export const countPendingInvites = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;

  const count = await inviteService.countPendingInvites(user.sub);

  res.status(200).json({
    success: true,
    data: { count },
  });
});

/**
 * DELETE /api/invites/:inviteId — Cancel a pending invite.
 */
export const cancelInvite = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { inviteId } = req.params;

  await inviteService.cancelInvite(inviteId, user.sub);

  res.status(200).json({
    success: true,
    message: "Invite cancelled successfully",
  });
});

/**
 * GET /api/conversations/:conversationId/invites — List group invites (admin).
 */
export const listGroupInvites = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const { conversationId } = req.params;

  const invites = await inviteService.listGroupInvites(conversationId, user.sub);

  res.status(200).json({
    success: true,
    data: invites,
    count: invites.length,
  });
});

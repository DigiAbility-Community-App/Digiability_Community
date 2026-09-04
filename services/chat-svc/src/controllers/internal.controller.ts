import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";
import { conversationRepository } from "../repositories/conversation.repository";
import { conversationService } from "../services/conversation.service";
import { messageService } from "../services/message.service";
import { logger } from "../config/logger";

// ─────────────────────────────────────────────────────────────
// Internal Controller
// Endpoints for trusted service-to-service calls only.
// Protected by internalAuth middleware — never call from clients.
// ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/internal/users/:userId/memberships
 * Called by user-svc when a user deletes their account, and by the admin
 * panel on user deletion / a moderation ban. Soft-removes the user from
 * every conversation they belong to, then runs a succession check on every
 * group where they held an admin-capable role — so deleting/banning a
 * group's only admin doesn't leave it stuck with nobody able to approve
 * members or moderate chat.
 */
export const removeUserMemberships = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ success: false, message: "userId is required." });
    return;
  }

  // Capture BEFORE stripping — once leftAt is set these won't show up in an
  // active-membership query any more.
  const adminConversations = await conversationRepository.getActiveAdminConversationIds(userId);

  const count = await conversationRepository.removeAllMemberships(userId);
  logger.info("Removed user memberships on account deletion", { userId, count });

  const promotions: Array<{ conversationId: string; promoted: { userId: string; role: string } | null }> = [];
  for (const { conversationId } of adminConversations) {
    const promoted = await conversationService.ensureAdminSuccession(conversationId);
    promotions.push({ conversationId, promoted });
  }

  res.status(200).json({ success: true, data: { removedCount: count, successions: promotions } });
});

/**
 * POST /api/internal/users/:userId/admin-succession-check
 * Called by the admin panel when a user is suspended (temporary — unlike
 * deletion/ban, suspension does NOT strip group membership). The suspended
 * user's own membership row is left untouched, but every group where they
 * currently hold an admin-capable role gets a stand-in promoted so it isn't
 * stuck while they're unable to act.
 */
export const adminSuccessionCheck = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ success: false, message: "userId is required." });
    return;
  }

  const adminConversations = await conversationRepository.getActiveAdminConversationIds(userId);

  const promotions: Array<{ conversationId: string; promoted: { userId: string; role: string } | null }> = [];
  for (const { conversationId } of adminConversations) {
    const promoted = await conversationService.ensureAdminSuccession(conversationId, userId);
    promotions.push({ conversationId, promoted });
  }

  logger.info("Admin succession check completed", { userId, groupsChecked: adminConversations.length });

  res.status(200).json({ success: true, data: { successions: promotions } });
});

/**
 * POST /api/internal/groups
 * Called by the admin panel to create a group. Goes through the normal
 * createConversation service logic (not raw SQL) so the new group gets a
 * real OWNER, Care Circle role validation, and member-limit enforcement —
 * exactly as if a real user had created it via the mobile/web app.
 */
export const adminCreateGroup = asyncHandler(async (req: Request, res: Response) => {
  const {
    subType, name, description, ownerId, initialMembers,
    maxMembers, editGroupInfo, addMembers, sendMessages, approveNewMembers,
  } = req.body as {
    subType?: "GENERAL" | "CARE_CIRCLE";
    name?: string;
    description?: string;
    ownerId?: string;
    initialMembers?: Array<{ userId: string; role: string }>;
    maxMembers?: number;
    editGroupInfo?: string;
    addMembers?: string;
    sendMessages?: string;
    approveNewMembers?: boolean;
  };

  if (!name || !ownerId) {
    res.status(400).json({ success: false, message: "name and ownerId are required." });
    return;
  }

  const others = (initialMembers || []).filter((m) => m.userId !== ownerId);
  const memberIds = others.map((m) => m.userId);

  const conversation = await conversationService.createConversation(
    ownerId,
    "GROUP",
    memberIds,
    name,
    subType || "GENERAL",
    description,
    others,
    { maxMembers, editGroupInfo, addMembers, sendMessages, approveNewMembers }
  );

  logger.info("Group created by admin", { conversationId: conversation.id, ownerId });

  res.status(200).json({ success: true, data: conversation });
});

/**
 * DELETE /api/internal/groups/:conversationId/members/:userId
 * Called by the admin panel to remove a group member. Privileged — no
 * "requester must be an admin member" check, since the caller here is the
 * moderation panel, not a group member — but still refuses to remove the
 * OWNER and runs a succession check if the removed member was admin-capable.
 */
export const adminRemoveMember = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId, userId } = req.params;

  if (!conversationId || !userId) {
    res.status(400).json({ success: false, message: "conversationId and userId are required." });
    return;
  }

  await conversationService.adminRemoveMember(conversationId, userId);

  res.status(200).json({ success: true });
});

/**
 * POST /api/internal/groups/:conversationId/transfer-ownership
 * Called by the admin panel to reassign a group's OWNER — the deliberate
 * "Super Admin can change this admin" action, distinct from automatic
 * succession.
 */
export const adminTransferOwnership = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const { newOwnerId } = req.body as { newOwnerId?: string };

  if (!conversationId || !newOwnerId) {
    res.status(400).json({ success: false, message: "conversationId and newOwnerId are required." });
    return;
  }

  await conversationService.adminTransferOwnership(conversationId, newOwnerId);

  res.status(200).json({ success: true });
});

/**
 * DELETE /api/internal/conversations/:conversationId
 * Called by the admin panel to delete a group. Goes through the normal
 * service layer (not raw SQL) so members get a real-time GROUP_DELETED WS
 * event instead of the deletion silently taking effect on their next fetch.
 */
export const adminDeleteConversation = asyncHandler(async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  if (!conversationId) {
    res.status(400).json({ success: false, message: "conversationId is required." });
    return;
  }

  await conversationService.adminDeleteGroup(conversationId);
  logger.info("Group deleted by admin", { conversationId });

  res.status(200).json({ success: true });
});

/**
 * DELETE /api/internal/messages/:messageId
 * Called by the admin moderation panel to remove a single reported message.
 * Goes through the normal service layer (not raw SQL) so conversation
 * members get a real-time MESSAGE_DELETED WS event instead of the removal
 * silently taking effect on their next fetch.
 */
export const adminDeleteMessage = asyncHandler(async (req: Request, res: Response) => {
  const { messageId } = req.params;
  const { conversationId } = req.body;

  if (!messageId || !conversationId) {
    res.status(400).json({ success: false, message: "messageId and conversationId are required." });
    return;
  }

  await messageService.adminDeleteMessage(messageId, conversationId);
  logger.info("Message deleted by admin", { messageId, conversationId });

  res.status(200).json({ success: true });
});

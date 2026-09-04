import { Router } from "express";
import { internalAuth } from "../middleware/internal.middleware";
import {
  removeUserMemberships,
  adminDeleteConversation,
  adminDeleteMessage,
  adminSuccessionCheck,
  adminCreateGroup,
  adminRemoveMember,
  adminTransferOwnership,
} from "../controllers/internal.controller";

// ─────────────────────────────────────────────────────────────
// Internal Routes
// Base path: /api/internal  (mounted in index.ts)
// All routes are protected by the shared INTERNAL_API_SECRET.
// ─────────────────────────────────────────────────────────────

const router = Router();

router.use(internalAuth);

// DELETE /api/internal/users/:userId/memberships
// Called by user-svc on account deletion to remove the user from all conversations.
router.delete("/users/:userId/memberships", removeUserMemberships);

// DELETE /api/internal/conversations/:conversationId
// Called by the admin panel to delete a group with real-time propagation.
router.delete("/conversations/:conversationId", adminDeleteConversation);

// DELETE /api/internal/messages/:messageId
// Called by the admin moderation panel to remove a reported message with
// real-time propagation. Body: { conversationId }.
router.delete("/messages/:messageId", adminDeleteMessage);

// POST /api/internal/users/:userId/admin-succession-check
// Called by the admin panel when a user is suspended (non-destructive —
// membership is kept). Promotes a stand-in admin in every group where the
// suspended user currently holds an admin-capable role.
router.post("/users/:userId/admin-succession-check", adminSuccessionCheck);

// POST /api/internal/groups
// Called by the admin panel to create a group with a real OWNER via the
// normal conversation-creation service logic. Body: { subType, name,
// description, ownerId, initialMembers: [{ userId, role }] }.
router.post("/groups", adminCreateGroup);

// DELETE /api/internal/groups/:conversationId/members/:userId
// Called by the admin panel to remove a group member with real-time
// propagation and a post-removal succession check.
router.delete("/groups/:conversationId/members/:userId", adminRemoveMember);

// POST /api/internal/groups/:conversationId/transfer-ownership
// Called by the admin panel to reassign a group's OWNER. Body: { newOwnerId }.
router.post("/groups/:conversationId/transfer-ownership", adminTransferOwnership);

export default router;

import { Router } from "express";
import { internalAuth } from "../middleware/internal.middleware";
import { removeUserMemberships, adminDeleteConversation } from "../controllers/internal.controller";

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

export default router;

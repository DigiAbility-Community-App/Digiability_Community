// ─────────────────────────────────────────────────────────────
// Invite Routes
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  sendInvite,
  respondToInvite,
  listPendingInvites,
  countPendingInvites,
  cancelInvite,
} from "../controllers/invite.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/invites/send — Send a group invite
router.post("/send", sendInvite);

// GET /api/invites/pending — List current user's pending invites
router.get("/pending", listPendingInvites);

// GET /api/invites/count — Count pending invites for badge
router.get("/count", countPendingInvites);

// POST /api/invites/:inviteId/respond — Accept or decline an invite
router.post("/:inviteId/respond", respondToInvite);

// DELETE /api/invites/:inviteId — Cancel a pending invite
router.delete("/:inviteId", cancelInvite);

export default router;

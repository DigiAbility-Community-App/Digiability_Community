// ─────────────────────────────────────────────────────────────
// Moderation Routes
//   POST   /api/moderation/block          { userId }
//   DELETE /api/moderation/block/:userId
//   GET    /api/moderation/blocked
//   POST   /api/moderation/report         { reportedUserId, conversationId?, messageId?, reason }
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  blockUser,
  unblockUser,
  listBlocked,
  reportUser,
} from "../controllers/moderation.controller";

const router = Router();

router.use(authenticate);

router.post("/block", blockUser);
router.delete("/block/:userId", unblockUser);
router.get("/blocked", listBlocked);
router.post("/report", reportUser);

export default router;

// ─────────────────────────────────────────────────────────────
// Moderation Routes
//   POST   /api/moderation/block          { userId }
//   DELETE /api/moderation/block/:userId
//   GET    /api/moderation/blocked
//   POST   /api/moderation/report         { reportedUserId, conversationId?, messageId?, reason }
//   GET    /api/moderation/reports/mine   ?conversationId=:id
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  blockUser,
  unblockUser,
  listBlocked,
  reportUser,
  listMyReportedMessages,
} from "../controllers/moderation.controller";

const router = Router();

router.use(authenticate);

router.post("/block", blockUser);
router.delete("/block/:userId", unblockUser);
router.get("/blocked", listBlocked);
router.post("/report", reportUser);
router.get("/reports/mine", listMyReportedMessages);

export default router;

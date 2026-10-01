import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createAppeal,
  listOwnAppeals,
  checkAppealability,
} from "../controllers/appeal.controller";

// ─────────────────────────────────────────────────────
// Appeal Routes — Community Guidelines "Appeals"
// Base path: /api/appeals
//
// An appeal disputes a specific enforcement decision, identified by the
// admin_audit_log entry the enforcement notice carries.
// ─────────────────────────────────────────────────────

const router = Router();

router.post("/", authenticate, createAppeal);
router.get("/", authenticate, listOwnAppeals);
router.get("/eligibility/:auditLogId", authenticate, checkAppealability);

export default router;

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  listConsents,
  updateConsent,
  withdrawConsentHandler,
  exportData,
} from "../controllers/privacy.controller";

// ─────────────────────────────────────────────────────
// Privacy Routes — DPDP Act 2023 / GDPR
// Base path: /api/auth/privacy  (mounted in index.ts via authRoutes,
//            or directly in app — see index.ts)
// All routes require a valid access token.
// ─────────────────────────────────────────────────────

const router = Router();

// Consent management (DPDP §6)
router.get("/consent", authenticate, listConsents);
router.post("/consent", authenticate, updateConsent);
router.delete("/consent/:type", authenticate, withdrawConsentHandler);

// Data portability / right to access (DPDP §11)
router.get("/export", authenticate, exportData);

export default router;

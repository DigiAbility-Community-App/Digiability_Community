import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { ReportSchema } from "../utils/validation.util";
import { createReport } from "../controllers/report.controller";

// ─────────────────────────────────────────────────────
// Report Routes
// Base path: /api/reports  (mounted in index.ts)
// All routes require authentication.
// ─────────────────────────────────────────────────────

const router = Router();

router.post("/", authenticate, validate(ReportSchema), createReport);

export default router;

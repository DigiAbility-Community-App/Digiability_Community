import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  submitGrievance,
  listOwnGrievances,
  listCategories,
} from "../controllers/grievance.controller";

// ─────────────────────────────────────────────────────
// Grievance Routes — IT Rules 2021 Rule 3(2)
// Base path: /api/grievances
//
// The formal complaint mechanism required alongside a named Grievance Officer.
// Distinct from content reports (/api/reports), which are about a specific
// piece of content rather than about the platform's own conduct.
// ─────────────────────────────────────────────────────

const router = Router();

router.get("/categories", listCategories);
router.post("/", authenticate, submitGrievance);
router.get("/", authenticate, listOwnGrievances);

export default router;

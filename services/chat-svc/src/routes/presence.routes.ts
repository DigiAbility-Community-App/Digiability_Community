// ─────────────────────────────────────────────────────────────
// Presence Routes
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getPresence,
  getBulkPresence,
  getActiveSessions,
  getServerStats,
} from "../controllers/presence.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/presence/:userId — Get single user presence
router.get("/:userId", getPresence);

// POST /api/presence/bulk — Get presence for multiple users
router.post("/bulk", getBulkPresence);

// GET /api/presence/sessions/me — Get caller's active sessions
router.get("/sessions/me", getActiveSessions);

// GET /api/presence/server/stats — Server connection stats
router.get("/server/stats", getServerStats);

export default router;

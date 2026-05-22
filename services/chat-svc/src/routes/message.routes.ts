// ─────────────────────────────────────────────────────────────
// Message Routes
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  getMessageHistory,
  getMissedMessages,
  markDelivered,
  markRead,
  getUnreadCounts,
} from "../controllers/message.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/messages/:conversationId/history — Fetch message history
router.get("/:conversationId/history", getMessageHistory);

// GET /api/messages/:conversationId/missed — Fetch missed messages since cursor
router.get("/:conversationId/missed", getMissedMessages);

// POST /api/messages/:messageId/delivered — Mark message as delivered
router.post("/:messageId/delivered", markDelivered);

// POST /api/messages/:messageId/read — Mark message as read
router.post("/:messageId/read", markRead);

// GET /api/messages/unread/counts — Get unread counts per conversation
router.get("/unread/counts", getUnreadCounts);

export default router;

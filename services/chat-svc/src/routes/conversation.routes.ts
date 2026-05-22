// ─────────────────────────────────────────────────────────────
// Conversation Routes
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import {
  createConversation,
  listConversations,
  getConversation,
  addMember,
  removeMember,
  initBot,
} from "../controllers/conversation.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/conversations — Create a new conversation
router.post("/", createConversation);

// GET /api/conversations — List user's conversations
router.get("/", listConversations);

// POST /api/conversations/init-bot — Initialize bot
router.post("/init-bot", initBot);

// GET /api/conversations/:conversationId — Get a single conversation
router.get("/:conversationId", getConversation);

// POST /api/conversations/:conversationId/members — Add member to group
router.post("/:conversationId/members", addMember);

// DELETE /api/conversations/:conversationId/members/:userId — Remove member
router.delete("/:conversationId/members/:userId", removeMember);

export default router;

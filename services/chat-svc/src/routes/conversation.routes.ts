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
  updateGroupInfo,
  updateGroupSettings,
  updateMemberRole,
  initBot,
} from "../controllers/conversation.controller";
import { listGroupInvites } from "../controllers/invite.controller";

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

// GET /api/conversations/:conversationId/invites — Get group invites
router.get("/:conversationId/invites", listGroupInvites);

// PATCH /api/conversations/:conversationId — Update group info (name, description)
router.patch("/:conversationId", updateGroupInfo);

// PATCH /api/conversations/:conversationId/settings — Update group permission settings
router.patch("/:conversationId/settings", updateGroupSettings);

// POST /api/conversations/:conversationId/members — Add member to group
router.post("/:conversationId/members", addMember);

// PATCH /api/conversations/:conversationId/members/:userId/role — Update member role
router.patch("/:conversationId/members/:userId/role", updateMemberRole);

// DELETE /api/conversations/:conversationId/members/:userId — Remove member
router.delete("/:conversationId/members/:userId", removeMember);

export default router;

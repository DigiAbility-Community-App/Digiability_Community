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
  transferOwnership,
  approveJoinRequest,
  muteConversation,
  pinConversation,
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

// POST /api/conversations/:conversationId/transfer-ownership — Transfer ownership
router.post("/:conversationId/transfer-ownership", transferOwnership);

// POST /api/conversations/join-requests/:inviteId/approve — Approve/reject join request
router.post("/join-requests/:inviteId/approve", approveJoinRequest);

// PATCH /api/conversations/:conversationId/mute — Mute/unmute conversation for current user
router.patch("/:conversationId/mute", muteConversation);

// PATCH /api/conversations/:conversationId/pin — Pin/unpin conversation for current user
router.patch("/:conversationId/pin", pinConversation);

export default router;

// ─────────────────────────────────────────────────────────────
// Zod Validation Schemas
// Input validation for all WebSocket and REST payloads.
// ─────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── WebSocket Payloads ───────────────────────────────────────

export const wsEnvelopeSchema = z.object({
  event: z.string().min(1).max(50),
  requestId: z.string().max(100).optional(),
  data: z.unknown(),
  timestamp: z.number().positive(),
});

export const messageSendSchema = z.object({
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  type: z.enum(["TEXT", "IMAGE", "FILE", "AUDIO", "VIDEO"]).default("TEXT"),
  metadata: z.string().max(5000).optional(),
});

export const messageDeliveredSchema = z.object({
  messageId: z.string().min(1),
});

export const messageReadSchema = z.object({
  messageId: z.string().min(1),
  conversationId: z.string().uuid(),
});

export const typingSchema = z.object({
  conversationId: z.string().uuid(),
});

export const syncRequestSchema = z.object({
  conversations: z.array(
    z.object({
      conversationId: z.string().uuid(),
      lastSequenceNo: z.number().int().min(0),
    })
  ).min(1).max(100),
});

// ─── REST API Payloads ────────────────────────────────────────

export const createConversationSchema = z.object({
  type: z.enum(["DIRECT", "GROUP"]),
  subType: z.enum(["GENERAL", "CARE_CIRCLE"]).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()).min(1).max(500),
  memberRoles: z.array(z.object({
    userId: z.string().uuid(),
    role: z.enum(["MEMBER", "ADMIN", "CAREGIVER", "MENTOR", "PROFESSIONAL"]),
  })).optional(),
});

export const sendInviteSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["MEMBER", "ADMIN", "CAREGIVER", "MENTOR", "PROFESSIONAL"]).default("MEMBER"),
  message: z.string().max(500).optional(),
});

export const respondInviteSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export const updateGroupSettingsSchema = z.object({
  editGroupInfo: z.enum(["ADMINS_ONLY", "ALL_MEMBERS"]).optional(),
  addMembers: z.enum(["ADMINS_ONLY", "ALL_MEMBERS"]).optional(),
  sendMessages: z.enum(["ADMINS_ONLY", "ALL_MEMBERS"]).optional(),
});

export const updateGroupInfoSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["MEMBER", "ADMIN", "CAREGIVER", "MENTOR", "PROFESSIONAL"]),
});

export const messageHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.number().int().min(0).optional(),  // sequenceNo cursor
});

export const missedMessagesQuerySchema = z.object({
  lastSequenceNo: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

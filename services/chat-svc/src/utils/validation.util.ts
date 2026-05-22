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
  name: z.string().min(1).max(200).optional(),
  memberIds: z.array(z.string().uuid()).min(1).max(500),
});

export const messageHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.coerce.number().int().min(0).optional(),  // sequenceNo cursor
});

export const missedMessagesQuerySchema = z.object({
  lastSequenceNo: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

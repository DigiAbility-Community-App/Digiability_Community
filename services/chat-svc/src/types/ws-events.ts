// ─────────────────────────────────────────────────────────────
// WebSocket Event Type Definitions
// Defines the full protocol for client ↔ server communication.
// All WS messages use a JSON envelope with event + requestId.
// ─────────────────────────────────────────────────────────────

// ─── Event Names ──────────────────────────────────────────────

export const WS_EVENTS = {
  // Client → Server
  MESSAGE_SEND: "message.send",
  MESSAGE_DELIVERED: "message.delivered",
  MESSAGE_READ: "message.read",
  TYPING_START: "typing.start",
  TYPING_STOP: "typing.stop",
  SESSION_PING: "session.ping",
  SYNC_REQUEST: "sync.request",

  // Server → Client
  MESSAGE_ACK: "message.ack",
  MESSAGE_NEW: "message.new",
  MESSAGE_DELIVERED_RECEIPT: "message.delivered.receipt",
  MESSAGE_READ_RECEIPT: "message.read.receipt",
  MESSAGE_DELETED: "message.deleted",
  PRESENCE_UPDATE: "presence.update",
  TYPING_START_BROADCAST: "typing.start.broadcast",
  TYPING_STOP_BROADCAST: "typing.stop.broadcast",
  SESSION_PONG: "session.pong",
  SYNC_RESPONSE: "sync.response",
  ERROR: "error",
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ─── Envelope ─────────────────────────────────────────────────

export interface WsEnvelope<T = unknown> {
  event: string;
  requestId?: string;       // Client-generated, echoed in responses
  data: T;
  timestamp: number;        // Unix ms
}

// ─── Client → Server Payloads ─────────────────────────────────

export interface MessageSendPayload {
  conversationId: string;
  clientMessageId: string;  // Client-generated UUID for dedupe
  content: string;
  type?: "TEXT" | "IMAGE" | "FILE" | "AUDIO" | "VIDEO";
  metadata?: string;        // JSON string for media info
}

export interface MessageDeliveredPayload {
  messageId: string;
}

export interface MessageReadPayload {
  messageId: string;
  conversationId: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface SyncRequestPayload {
  conversations: Array<{
    conversationId: string;
    lastSequenceNo: number;
  }>;
}

// ─── Server → Client Payloads ─────────────────────────────────

export interface MessageAckPayload {
  clientMessageId: string;
  messageId: string;
  sequenceNo: number;
  status: "accepted" | "rejected";
  reason?: string;
  timestamp: number;
}

export interface MessageNewPayload {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string;
  type: string;
  metadata?: string;
  sequenceNo: number;
  createdAt: string;
}

export interface DeliveryReceiptPayload {
  messageId: string;
  conversationId: string;
  userId: string;
  timestamp: number;
}

export interface ReadReceiptPayload {
  messageId: string;
  conversationId: string;
  userId: string;
  timestamp: number;
}

export interface PresenceUpdatePayload {
  userId: string;
  status: "online" | "offline";
  lastSeen?: string;
}

export interface TypingBroadcastPayload {
  conversationId: string;
  userId: string;
}

export interface SyncResponsePayload {
  conversationId: string;
  messages: MessageNewPayload[];
  hasMore: boolean;
  nextCursor?: number;     // sequenceNo to continue from
}

export interface WsErrorPayload {
  code: string;
  message: string;
  requestId?: string;
}

// ─── Error Codes ──────────────────────────────────────────────

export const WS_ERROR_CODES = {
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  UNKNOWN_EVENT: "UNKNOWN_EVENT",
  AUTH_FAILED: "AUTH_FAILED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  NOT_A_MEMBER: "NOT_A_MEMBER",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CONVERSATION_NOT_FOUND: "CONVERSATION_NOT_FOUND",
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

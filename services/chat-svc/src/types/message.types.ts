// ─────────────────────────────────────────────────────────────
// Message-related Type Definitions
// Shared across services, handlers, and workers.
// ─────────────────────────────────────────────────────────────

/** Payload written to the msg:created Redis Stream */
export interface MessageCreatedEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  type: string;
  metadata?: string;
  createdAt: string;       // ISO 8601
}

/** Payload written to the msg:persisted Redis Stream */
export interface MessagePersistedEvent {
  messageId: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  content: string;
  type: string;
  metadata?: string;
  sequenceNo: string;      // BigInt serialized as string
  createdAt: string;
}

/** Payload written to the msg:notify Redis Stream */
export interface MessageNotifyEvent {
  messageId: string;
  conversationId: string;
  conversationName?: string;
  senderId: string;
  senderName?: string;
  recipientId: string;
  contentPreview: string;  // Truncated for push notification
  type: string;
  createdAt: string;
}

/** Payload published via Pub/Sub for cross-server delivery */
export interface DeliveryPayload {
  targetUserId: string;
  message: {
    messageId: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    metadata?: string;
    sequenceNo: string;
    createdAt: string;
  };
}

/** Receipt update broadcast via Pub/Sub */
export interface ReceiptBroadcastPayload {
  targetUserId: string;   // The sender who should see this receipt
  messageId: string;
  conversationId: string;
  userId: string;          // The user who generated the receipt
  type: "delivered" | "read";
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────
// Message Send Handler
//
// Handles the `message.send` event from clients.
// This is the critical path for message creation:
//
//   1. Validate payload (Zod)
//   2. Verify sender is a member of the conversation
//   3. Generate a ULID messageId
//   4. XADD to msg:created stream (durable acceptance)
//   5. Send ACK to sender immediately
//
// The ACK means "your message has been durably accepted into
// the system." It does NOT mean the message is persisted to DB
// or delivered to recipients — those happen asynchronously.
//
// Latency target: < 5ms from receive to ACK (Redis XADD is ~1ms).
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../../config/logger";
import { messageSendSchema } from "../../utils/validation.util";
import { generateMessageId } from "../../utils/id.util";
import { publishMessageCreated } from "../../streams/producer";
import { connectionManager } from "../connection-manager";
import { conversationRepository } from "../../repositories/conversation.repository";
import {
  WS_EVENTS,
  WS_ERROR_CODES,
  WsEnvelope,
  MessageAckPayload,
  MessageNewPayload,
} from "../../types/ws-events";

export async function handleMessageSend(
  ws: WebSocket,
  connId: string,
  userId: string,
  _deviceId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  // ── 1. Validate payload ──────────────────────────────────
  const parsed = messageSendSchema.safeParse(data);
  if (!parsed.success) {
    sendAck(ws, {
      clientMessageId: (data as Record<string, unknown>)?.clientMessageId as string ?? "unknown",
      messageId: "",
      sequenceNo: 0,
      status: "rejected",
      reason: `Invalid payload: ${parsed.error.issues.map(i => i.message).join(", ")}`,
      timestamp: Date.now(),
    }, requestId);
    return;
  }

  const { conversationId, clientMessageId, content, type, metadata } = parsed.data;

  try {
    // ── 2. Verify membership ───────────────────────────────────
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) {
      sendAck(ws, {
        clientMessageId,
        messageId: "",
        sequenceNo: 0,
        status: "rejected",
        reason: "You are not a member of this conversation",
        timestamp: Date.now(),
      }, requestId);
      return;
    }

    // ── 3. Generate message ID ─────────────────────────────────
    const messageId = generateMessageId();
    const createdAt = new Date().toISOString();

    // ── 4. Publish to Redis Stream (durable acceptance) ────────
    // This is the point of no return. Once XADD succeeds, the
    // message is durably in the system and will be persisted by
    // the msg-svc worker.
    console.log('[TRACE] 📤 Publishing to msg:created stream', { messageId, conversationId, senderId: userId });
    await publishMessageCreated({
      messageId,
      conversationId,
      senderId: userId,
      clientMessageId,
      content,
      type: type || "TEXT",
      metadata,
      createdAt,
    });
    console.log('[TRACE] ✅ Published to msg:created stream successfully');

    // ── 5. ACK to sender ───────────────────────────────────────
    // sequenceNo is 0 here because it's assigned by the msg-svc
    // worker during persistence. The final sequenceNo will arrive
    // via the message.new event to the sender's other devices.
    sendAck(ws, {
      clientMessageId,
      messageId,
      sequenceNo: 0,  // Assigned later by msg-svc
      status: "accepted",
      timestamp: Date.now(),
    }, requestId);

    // ── 6. Echo to sender's other devices ──────────────────────
    // The sender's other devices should see the message immediately.
    // They'll get the final sequenceNo when the delivery worker
    // processes the MESSAGE_PERSISTED event.
    const echoPayload: MessageNewPayload = {
      messageId,
      conversationId,
      senderId: userId,
      content,
      type: type || "TEXT",
      metadata,
      sequenceNo: 0,  // Placeholder, updated after persistence
      createdAt,
    };

    connectionManager.sendToUserExcept(userId, connId, {
      event: WS_EVENTS.MESSAGE_NEW,
      data: echoPayload,
      timestamp: Date.now(),
    });

    logger.info("Message accepted", {
      messageId,
      clientMessageId,
      conversationId,
      userId,
      connId,
    });
  } catch (err) {
    logger.error("Failed to process message.send", {
      clientMessageId,
      conversationId,
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });

    sendAck(ws, {
      clientMessageId,
      messageId: "",
      sequenceNo: 0,
      status: "rejected",
      reason: "Internal error — please retry",
      timestamp: Date.now(),
    }, requestId);
  }
}

function sendAck(
  ws: WebSocket,
  payload: MessageAckPayload,
  requestId?: string
): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const envelope: WsEnvelope<MessageAckPayload> = {
    event: WS_EVENTS.MESSAGE_ACK,
    requestId,
    data: payload,
    timestamp: Date.now(),
  };

  ws.send(JSON.stringify(envelope));
}

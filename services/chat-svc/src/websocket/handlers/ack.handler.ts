// ─────────────────────────────────────────────────────────────
// Delivery / Read ACK Handlers
//
// Handles receipt acknowledgements from clients:
//   - message.delivered: client confirms it displayed the message
//   - message.read: client confirms the user opened/read the message
//
// Flow:
//   1. Validate payload
//   2. Update MessageRecipient status in DB
//   3. Create MessageReceipt audit entry
//   4. Broadcast receipt to sender's active sessions
//
// Edge case: read receipt before delivery receipt (race condition)
//   → message.read implies delivered. We update both states atomically.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../../config/logger";
import { messageDeliveredSchema, messageReadSchema } from "../../utils/validation.util";
import { messageRepository } from "../../repositories/message.repository";
import { registryService } from "../../services/registry.service";
import { connectionManager } from "../connection-manager";
import { redis } from "../../config/redis";
import { PUBSUB_CHANNELS } from "../../streams/constants";
import { env } from "../../config/env";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope } from "../../types/ws-events";
import { ReceiptBroadcastPayload } from "../../types/message.types";

export async function handleMessageDelivered(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  const parsed = messageDeliveredSchema.safeParse(data);
  if (!parsed.success) {
    sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid delivered payload", requestId);
    return;
  }

  const { messageId } = parsed.data;

  try {
    // Update delivery status (idempotent — skips if already delivered/read)
    const result = await messageRepository.markDelivered(messageId, userId);

    if (result) {
      // Create audit receipt
      await messageRepository.createReceipt(messageId, userId, "DELIVERED");

      // Broadcast receipt to the message sender
      await broadcastReceipt({
        targetUserId: result.senderId,
        messageId,
        conversationId: result.conversationId,
        userId,
        type: "delivered",
        timestamp: Date.now(),
      });
    }

    logger.debug("Delivery receipt processed", { messageId, userId, connId });
  } catch (err) {
    logger.error("Failed to process delivery receipt", {
      messageId,
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function handleMessageRead(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  const parsed = messageReadSchema.safeParse(data);
  if (!parsed.success) {
    sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid read payload", requestId);
    return;
  }

  const { messageId, conversationId } = parsed.data;

  try {
    // message.read implies delivered — update both states
    const result = await messageRepository.markRead(messageId, userId);

    // Advance the read cursor even when markRead returns null. Group messages
    // sent before this user joined (or their own messages) have no
    // MessageRecipient row, so markRead is a no-op — but they still count
    // toward unread until the cursor moves past them. Without this the badge
    // shows a phantom unread that reopening the chat can never clear.
    const sequenceNo = result?.sequenceNo
      ?? await messageRepository.getMessageSequenceNo(messageId);
    if (sequenceNo != null) {
      await messageRepository.updateReadCursor(conversationId, userId, sequenceNo);
    }

    if (result) {
      // Create audit receipt
      await messageRepository.createReceipt(messageId, userId, "READ");

      // Broadcast receipt to sender
      // Deliberately disabled to prevent read receipts from leaking to senders, ensuring privacy.
      // await broadcastReceipt({
      //   targetUserId: result.senderId,
      //   messageId,
      //   conversationId,
      //   userId,
      //   type: "read",
      //   timestamp: Date.now(),
      // });
    }

    logger.debug("Read receipt processed", { messageId, conversationId, userId, connId });
  } catch (err) {
    logger.error("Failed to process read receipt", {
      messageId,
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

/**
 * Broadcast a receipt update to the sender across all their devices.
 * First tries local connections, then publishes via Pub/Sub for
 * connections on other servers.
 */
async function broadcastReceipt(payload: ReceiptBroadcastPayload): Promise<void> {
  const envelope: WsEnvelope = {
    event: payload.type === "delivered"
      ? WS_EVENTS.MESSAGE_DELIVERED_RECEIPT
      : WS_EVENTS.MESSAGE_READ_RECEIPT,
    data: {
      messageId: payload.messageId,
      conversationId: payload.conversationId,
      userId: payload.userId,
      timestamp: payload.timestamp,
    },
    timestamp: Date.now(),
  };

  // Try local connections first
  const localSent = connectionManager.sendToUser(payload.targetUserId, envelope);

  // Also publish via Pub/Sub for other server instances
  const sessions = await registryService.getUserSessions(payload.targetUserId);
  const remoteServerIds = new Set<string>();

  for (const session of sessions) {
    if (session.serverId !== env.SERVER_ID) {
      remoteServerIds.add(session.serverId);
    }
  }

  for (const serverId of remoteServerIds) {
    await redis.publish(
      PUBSUB_CHANNELS.SERVER_RECEIPT(serverId),
      JSON.stringify(payload)
    );
  }

  logger.debug("Receipt broadcast", {
    messageId: payload.messageId,
    targetUserId: payload.targetUserId,
    localSent: String(localSent),
    remoteServers: String(remoteServerIds.size),
  });
}

function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  requestId?: string
): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    event: WS_EVENTS.ERROR,
    requestId,
    data: { code, message, requestId },
    timestamp: Date.now(),
  }));
}

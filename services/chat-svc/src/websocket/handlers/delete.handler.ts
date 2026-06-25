// ─────────────────────────────────────────────────────────────
// Delete Message Handler
//
// Handles the `message.delete` event from clients.
// Supports two modes (WhatsApp-style):
//   - "everyone": Soft-deletes the message for all participants
//   - "me":       Hides the message for only the requesting user
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../../config/logger";
import { messageDeleteSchema } from "../../utils/validation.util";
import { messageRepository } from "../../repositories/message.repository";
import { conversationRepository } from "../../repositories/conversation.repository";
import { connectionManager } from "../connection-manager";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope, MessageDeletePayload } from "../../types/ws-events";

// 48 hours in milliseconds — messages older than this cannot be deleted for everyone
const DELETE_FOR_EVERYONE_WINDOW_MS = 48 * 60 * 60 * 1000;

// Roles with admin-level access per group type
const CARE_CIRCLE_ADMIN_ROLES = ["OWNER", "CAREGIVER"];
const GROUP_ADMIN_ROLES = ["OWNER", "ADMIN"];

export async function handleMessageDelete(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  try {
    // ── 1. Validate payload ────────────────────────────────
    const parsed = messageDeleteSchema.safeParse(data);
    if (!parsed.success) {
      sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid delete payload", requestId);
      return;
    }

    const { messageId, conversationId, deleteFor } = parsed.data;

    // ── 2. Verify membership ───────────────────────────────
    const isMember = await conversationRepository.isMember(conversationId, userId);
    if (!isMember) {
      sendError(ws, WS_ERROR_CODES.NOT_A_MEMBER, "You are not a member of this conversation", requestId);
      return;
    }

    // ── 3. Fetch the original message ──────────────────────
    const message = await messageRepository.getMessageById(messageId, conversationId);
    if (!message) {
      sendError(ws, WS_ERROR_CODES.MESSAGE_NOT_FOUND, "Message not found", requestId);
      return;
    }

    // Already deleted
    if (message.status === "DELETED") {
      sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Message is already deleted", requestId);
      return;
    }

    // ── 4. Handle "Delete for Me" ──────────────────────────
    if (deleteFor === "me") {
      await messageRepository.hideMessageForUser(userId, messageId);

      // Confirm to the requesting user only
      sendAck(ws, {
        messageId,
        conversationId,
        deleteFor: "me",
        status: "deleted",
      }, requestId);

      logger.info("Message hidden for user (delete for me)", {
        messageId, conversationId, userId,
      });
      return;
    }

    // ── 5. Handle "Delete for Everyone" ────────────────────
    // Permission check: must be the message sender OR a group admin
    const isMessageSender = message.senderId === userId;
    let isAdmin = false;

    if (!isMessageSender) {
      const conversation = await conversationRepository.getById(conversationId);
      const role = await conversationRepository.getMemberRole(conversationId, userId);
      if (role && conversation) {
        isAdmin = conversation.subType === "CARE_CIRCLE"
          ? CARE_CIRCLE_ADMIN_ROLES.includes(role)
          : GROUP_ADMIN_ROLES.includes(role);
      }
    }

    if (!isMessageSender && !isAdmin) {
      sendError(
        ws,
        WS_ERROR_CODES.PERMISSION_DENIED,
        "Only the sender or a group admin can delete messages for everyone",
        requestId
      );
      return;
    }

    // Time window check (48 hours) — only for non-admins
    if (!isAdmin) {
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      if (messageAge > DELETE_FOR_EVERYONE_WINDOW_MS) {
        sendError(
          ws,
          WS_ERROR_CODES.PERMISSION_DENIED,
          "Messages older than 48 hours cannot be deleted for everyone",
          requestId
        );
        return;
      }
    }

    // Perform the soft-delete
    await messageRepository.softDeleteMessage(messageId, conversationId);

    // Broadcast to all conversation members
    const memberIds = await conversationRepository.getMemberIds(conversationId);
    const deleteEvent: WsEnvelope = {
      event: WS_EVENTS.MESSAGE_DELETED,
      requestId,
      data: {
        messageId,
        conversationId,
        deletedBy: userId,
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    for (const memberId of memberIds) {
      try {
        connectionManager.sendToUser(memberId, deleteEvent);
      } catch {
        // User may be offline — non-fatal
      }
    }

    logger.info("Message deleted for everyone", {
      messageId, conversationId, deletedBy: userId, isAdmin,
    });

  } catch (error) {
    logger.error("Failed to process message.delete", {
      error: error instanceof Error ? error.message : String(error),
      userId,
      connId,
    });
    sendError(ws, WS_ERROR_CODES.INTERNAL_ERROR, "Failed to delete message", requestId);
  }
}

function sendAck(ws: WebSocket, data: any, requestId?: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: WS_EVENTS.MESSAGE_DELETED,
    requestId,
    data,
    timestamp: Date.now(),
  }));
}

function sendError(ws: WebSocket, code: string, message: string, requestId?: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: WS_EVENTS.ERROR,
    requestId,
    data: { code, message, requestId },
    timestamp: Date.now(),
  }));
}

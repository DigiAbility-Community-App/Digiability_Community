// ─────────────────────────────────────────────────────────────
// Typing Indicator Handlers
//
// Ephemeral events — NOT persisted, NOT streamed.
// Broadcast directly via Pub/Sub to other conversation members.
// If a recipient misses a typing indicator, nothing bad happens.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../../config/logger";
import { typingSchema } from "../../utils/validation.util";
import { conversationRepository } from "../../repositories/conversation.repository";
import { registryService } from "../../services/registry.service";
import { connectionManager } from "../connection-manager";
import { redis } from "../../config/redis";
import { env } from "../../config/env";
import { PUBSUB_CHANNELS } from "../../streams/constants";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope } from "../../types/ws-events";

export async function handleTypingStart(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  await handleTypingEvent(ws, connId, userId, data, "start", requestId);
}

export async function handleTypingStop(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  requestId?: string
): Promise<void> {
  await handleTypingEvent(ws, connId, userId, data, "stop", requestId);
}

async function handleTypingEvent(
  ws: WebSocket,
  connId: string,
  userId: string,
  data: unknown,
  action: "start" | "stop",
  requestId?: string
): Promise<void> {
  const parsed = typingSchema.safeParse(data);
  if (!parsed.success) {
    sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid typing payload", requestId);
    return;
  }

  const { conversationId } = parsed.data;

  try {
    // Get all members of the conversation (excluding sender)
    const memberIds = await conversationRepository.getMemberIds(conversationId);
    const otherMembers = memberIds.filter((id) => id !== userId);

    if (otherMembers.length === 0) return;

    const eventName = action === "start"
      ? WS_EVENTS.TYPING_START_BROADCAST
      : WS_EVENTS.TYPING_STOP_BROADCAST;

    const envelope: WsEnvelope = {
      event: eventName,
      data: { conversationId, userId },
      timestamp: Date.now(),
    };

    // Broadcast to local connections of other members
    const remoteServerIds = new Set<string>();

    for (const memberId of otherMembers) {
      // Try local delivery first
      connectionManager.sendToUser(memberId, envelope);

      // Check for remote sessions
      const sessions = await registryService.getUserSessions(memberId);
      for (const session of sessions) {
        if (session.serverId !== env.SERVER_ID) {
          remoteServerIds.add(session.serverId);
        }
      }
    }

    // Publish to remote servers via Pub/Sub
    const pubsubPayload = JSON.stringify({
      event: eventName,
      conversationId,
      userId,
      targetUserIds: otherMembers,
    });

    for (const serverId of remoteServerIds) {
      await redis.publish(PUBSUB_CHANNELS.SERVER_TYPING(serverId), pubsubPayload);
    }
  } catch (err) {
    // Typing failures are not critical — log and move on
    logger.debug("Typing broadcast failed", {
      conversationId,
      userId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

function sendError(ws: WebSocket, code: string, message: string, requestId?: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    event: WS_EVENTS.ERROR,
    requestId,
    data: { code, message },
    timestamp: Date.now(),
  }));
}

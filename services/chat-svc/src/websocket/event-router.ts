// ─────────────────────────────────────────────────────────────
// WebSocket Event Router
//
// Dispatches inbound WS messages to the correct handler based
// on the `event` field in the JSON envelope. Validates the
// envelope schema before routing.
//
// This is the only place that maps event names to handlers.
// Adding a new event type requires only adding a case here.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../config/logger";
import { wsEnvelopeSchema } from "../utils/validation.util";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope } from "../types/ws-events";
import { handleMessageSend } from "./handlers/message.handler";
import { handleMessageDelivered, handleMessageRead } from "./handlers/ack.handler";
import { handleSyncRequest } from "./handlers/sync.handler";
import { handleTypingStart, handleTypingStop } from "./handlers/typing.handler";
import { handleSessionPing } from "./handlers/session.handler";

/**
 * Route an inbound WebSocket event to the appropriate handler.
 * Called by the gateway for every parsed message.
 */
export function routeEvent(
  ws: WebSocket,
  connId: string,
  userId: string,
  deviceId: string,
  envelope: WsEnvelope
): void {
  // Validate envelope structure
  const parsed = wsEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    sendError(ws, WS_ERROR_CODES.INVALID_PAYLOAD, "Invalid message envelope", envelope.requestId);
    return;
  }

  const { event, data, requestId } = parsed.data;

  switch (event) {
    case WS_EVENTS.MESSAGE_SEND:
      handleMessageSend(ws, connId, userId, deviceId, data, requestId);
      break;

    case WS_EVENTS.MESSAGE_DELIVERED:
      handleMessageDelivered(ws, connId, userId, data, requestId);
      break;

    case WS_EVENTS.MESSAGE_READ:
      handleMessageRead(ws, connId, userId, data, requestId);
      break;

    case WS_EVENTS.TYPING_START:
      handleTypingStart(ws, connId, userId, data, requestId);
      break;

    case WS_EVENTS.TYPING_STOP:
      handleTypingStop(ws, connId, userId, data, requestId);
      break;

    case WS_EVENTS.SESSION_PING:
      handleSessionPing(ws, connId, userId);
      break;

    case WS_EVENTS.SYNC_REQUEST:
      handleSyncRequest(ws, connId, userId, data, requestId);
      break;

    default:
      logger.warn("Unknown WS event", { event, userId, connId });
      sendError(ws, WS_ERROR_CODES.UNKNOWN_EVENT, `Unknown event: ${event}`, requestId);
  }
}

function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  requestId?: string
): void {
  if (ws.readyState !== WebSocket.OPEN) return;

  const envelope: WsEnvelope = {
    event: WS_EVENTS.ERROR,
    requestId,
    data: { code, message, requestId },
    timestamp: Date.now(),
  };

  ws.send(JSON.stringify(envelope));
}

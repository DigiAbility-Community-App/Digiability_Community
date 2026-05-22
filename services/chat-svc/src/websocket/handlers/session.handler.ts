// ─────────────────────────────────────────────────────────────
// Session Ping Handler
//
// Handles application-level `session.ping` from clients.
// This is separate from the WebSocket-level ping/pong (which
// is handled in the gateway). Application-level pings allow
// the client to verify the connection is alive and get server time.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { WS_EVENTS, WsEnvelope } from "../../types/ws-events";
import { registryService } from "../../services/registry.service";

export async function handleSessionPing(
  ws: WebSocket,
  _connId: string,
  userId: string
): Promise<void> {
  // Refresh registry heartbeat
  await registryService.heartbeat(userId).catch(() => {});

  // Respond with pong + server timestamp
  if (ws.readyState === WebSocket.OPEN) {
    const envelope: WsEnvelope = {
      event: WS_EVENTS.SESSION_PONG,
      data: { serverTime: Date.now() },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(envelope));
  }
}

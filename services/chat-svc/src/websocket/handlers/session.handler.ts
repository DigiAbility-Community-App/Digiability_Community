// ─────────────────────────────────────────────────────────────
// Session Ping Handler
//
// Handles application-level `session.ping` from clients.
// On every ping we:
//   1. Refresh the Redis registry TTL (keep session alive)
//   2. Check whether the JWT has been revoked (logout/deletion)
//   3. Check whether the JWT has expired (long-lived connections)
//   4. If invalid: send error event and close the connection
//   5. Otherwise: send session.pong with server time
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { WS_EVENTS, WS_ERROR_CODES, WsEnvelope } from "../../types/ws-events";
import { registryService } from "../../services/registry.service";
import { connectionManager } from "../connection-manager";
import { redis } from "../../config/redis";
import { logger } from "../../config/logger";

const JTI_PREFIX = "revoked:jti:";

async function isJtiRevoked(jti: string): Promise<boolean> {
  try {
    const val = await redis.get(`${JTI_PREFIX}${jti}`);
    return val === "1";
  } catch {
    return false;
  }
}

export async function handleSessionPing(
  ws: WebSocket,
  connId: string,
  userId: string
): Promise<void> {
  // Refresh registry heartbeat so the session doesn't expire
  await registryService.heartbeat(userId).catch(() => {});

  // Re-validate the token on each heartbeat to catch revocations and expiry
  // on long-lived connections (logout, account deletion, token theft).
  const conn = connectionManager.getByConnId(connId);
  if (conn) {
    const now = Math.floor(Date.now() / 1000);

    // Check token expiry
    if (conn.tokenExp && conn.tokenExp < now) {
      logger.info("WS token expired during session — closing connection", { connId, userId });
      _closeWithError(ws, WS_ERROR_CODES.TOKEN_EXPIRED, "Session token has expired. Please reconnect.");
      return;
    }

    // Check JTI revocation blocklist
    if (conn.jti) {
      const revoked = await isJtiRevoked(conn.jti);
      if (revoked) {
        logger.info("WS token revoked during session — closing connection", { connId, userId });
        _closeWithError(ws, WS_ERROR_CODES.AUTH_FAILED, "Session has been revoked. Please log in again.");
        return;
      }
    }
  }

  // Valid session — respond with pong
  if (ws.readyState === WebSocket.OPEN) {
    const envelope: WsEnvelope = {
      event: WS_EVENTS.SESSION_PONG,
      data: { serverTime: Date.now() },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(envelope));
  }
}

function _closeWithError(ws: WebSocket, code: string, message: string): void {
  if (ws.readyState === WebSocket.OPEN) {
    const envelope: WsEnvelope = {
      event: WS_EVENTS.ERROR,
      data: { code, message },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(envelope));
    ws.close(1008, message); // 1008 = Policy Violation
  }
}

// ─────────────────────────────────────────────────────────────
// WebSocket Gateway
//
// Handles HTTP → WebSocket upgrade with JWT authentication.
// This is the entry point for all client WebSocket connections.
//
// Authentication flow:
//   1. Client connects: ws://host:4002/ws?token=JWT&deviceId=xxx
//   2. Gateway extracts token from query string
//   3. Verifies JWT using user-svc's public key
//   4. If valid: upgrades connection, registers in manager + registry
//   5. If invalid: rejects with 401
//
// The gateway does NOT own business logic. It only:
//   - Authenticates
//   - Registers connections
//   - Wires up event router for message handling
//   - Handles close/error cleanup
// ─────────────────────────────────────────────────────────────

import { IncomingMessage } from "http";
import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { tryVerifyAccessToken } from "../utils/jwt.util";
import { generateConnId } from "../utils/id.util";
import { connectionManager } from "./connection-manager";
import { registryService } from "../services/registry.service";
import { routeEvent } from "./event-router";
import { WS_EVENTS, WS_ERROR_CODES } from "../types/ws-events";
import type { WsEnvelope } from "../types/ws-events";
import { checkSuspended } from "../utils/suspension.util";

/**
 * Attach WebSocket server to an existing HTTP server.
 * Handles upgrade requests on the /ws path.
 */
export function attachWebSocketGateway(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade requests manually for auth
  httpServer.on("upgrade", async (request: IncomingMessage, socket, head) => {
    const pathname = parsePathname(request);

    // Only handle upgrades on /ws path
    if (pathname !== "/ws") {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }

    // Extract and verify JWT token
    const token = parseToken(request);
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nMissing token\n");
      socket.destroy();
      return;
    }

    const user = tryVerifyAccessToken(token);
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nInvalid or expired token\n");
      socket.destroy();
      return;
    }

    // Block suspended/banned accounts from opening a new WS session. (An
    // already-open socket from before the ban isn't force-closed here — that
    // would need a separate broadcast — but no NEW connection is possible.)
    try {
      const suspension = await checkSuspended(user.sub);
      if (suspension) {
        socket.write("HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nAccount suspended\n");
        socket.destroy();
        return;
      }
    } catch (err) {
      logger.error("WS suspension check failed", { error: err instanceof Error ? err.message : String(err) });
      // Fail open — don't take down chat for everyone on a transient DB error.
    }

    // Extract device ID (required for multi-device tracking)
    const deviceId = parseDeviceId(request) || "unknown";

    // Upgrade the connection
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, user, deviceId);
    });
  });

  // Handle new authenticated connections
  wss.on("connection", async (
    ws: WebSocket,
    _request: IncomingMessage,
    user: { sub: string; email: string },
    deviceId: string
  ) => {
    const connId = generateConnId();
    const userId = user.sub;
    const now = new Date();

    // Add to in-memory connection manager
    connectionManager.add({
      ws,
      userId,
      connId,
      deviceId,
      connectedAt: now,
    });

    // Register in Redis for cross-server routing
    await registryService.register({
      connId,
      serverId: env.SERVER_ID,
      deviceId,
      userId,
      connectedAt: now.toISOString(),
      lastPing: now.toISOString(),
    });

    logger.info("WebSocket connected", { userId, connId, deviceId, serverId: env.SERVER_ID });

    // Send connection confirmation
    sendEvent(ws, {
      event: "connection.established",
      data: { connId, serverId: env.SERVER_ID, userId },
      timestamp: Date.now(),
    });

    // ── Wire up event handling ──────────────────────────────────

    ws.on("message", (raw: Buffer | string) => {
      handleIncomingMessage(ws, connId, userId, deviceId, raw);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      handleDisconnect(connId, userId, code, reason.toString());
    });

    ws.on("error", (err: Error) => {
      logger.error("WebSocket error", { connId, userId, error: err.message });
      handleDisconnect(connId, userId, 1006, err.message);
    });

    // Heartbeat: ping every interval, close if no pong
    setupHeartbeat(ws, connId, userId);
  });

  logger.info("WebSocket gateway attached");
  return wss;
}

// ─── Internal Helpers ───────────────────────────────────────

function parsePathname(request: IncomingMessage): string {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    return url.pathname;
  } catch {
    return "/";
  }
}

function parseToken(request: IncomingMessage): string | null {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    // Primary: query string token
    const queryToken = url.searchParams.get("token");
    if (queryToken) return queryToken;

    // Fallback: Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }

    return null;
  } catch {
    return null;
  }
}

function parseDeviceId(request: IncomingMessage): string | null {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    return url.searchParams.get("deviceId");
  } catch {
    return null;
  }
}

function handleIncomingMessage(
  ws: WebSocket,
  connId: string,
  userId: string,
  deviceId: string,
  raw: Buffer | string
): void {
  const text = typeof raw === "string" ? raw : raw.toString("utf-8");

  // Guard against oversized messages
  if (text.length > 65536) {
    sendEvent(ws, {
      event: WS_EVENTS.ERROR,
      data: { code: WS_ERROR_CODES.INVALID_PAYLOAD, message: "Message too large" },
      timestamp: Date.now(),
    });
    return;
  }

  let envelope: WsEnvelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    sendEvent(ws, {
      event: WS_EVENTS.ERROR,
      data: { code: WS_ERROR_CODES.INVALID_PAYLOAD, message: "Invalid JSON" },
      timestamp: Date.now(),
    });
    return;
  }

  // Route to the appropriate handler
  routeEvent(ws, connId, userId, deviceId, envelope);
}

async function handleDisconnect(
  connId: string,
  userId: string,
  code: number,
  reason: string
): Promise<void> {
  logger.info("WebSocket disconnected", { connId, userId, code: String(code), reason });

  // Remove from in-memory manager
  connectionManager.remove(connId);

  // Remove from Redis registry
  await registryService.unregister(userId, connId);
}

function sendEvent(ws: WebSocket, envelope: WsEnvelope): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(envelope));
  }
}

/**
 * Server-initiated ping/pong heartbeat.
 * If client doesn't respond to ping within 30s, we consider it dead.
 */
function setupHeartbeat(ws: WebSocket, connId: string, userId: string): void {
  let isAlive = true;

  ws.on("pong", () => {
    isAlive = true;
  });

  const interval = setInterval(async () => {
    if (!isAlive) {
      logger.warn("Heartbeat timeout — terminating connection", { connId, userId });
      clearInterval(interval);
      ws.terminate();
      return;
    }

    isAlive = false;
    ws.ping();

    // Refresh registry TTL
    await registryService.heartbeat(userId).catch((err) => {
      logger.error("Heartbeat registry refresh failed", {
        connId,
        userId,
        error: err instanceof Error ? err.message : "unknown",
      });
    });
  }, env.HEARTBEAT_INTERVAL_MS);

  ws.on("close", () => clearInterval(interval));
}

// ─────────────────────────────────────────────────────────────
// WebSocket Connection Manager
//
// In-memory registry of live WebSocket connections owned by
// THIS server instance. This is NOT shared across servers —
// Redis registry handles cross-server routing.
//
// Two maps are maintained:
//   connId → { ws, userId, deviceId }
//   userId → Set<connId>
//
// Thread-safety note: Node.js is single-threaded, so no
// locking is needed for map operations.
// ─────────────────────────────────────────────────────────────

import WebSocket from "ws";
import { logger } from "../config/logger";
import { WsEnvelope } from "../types/ws-events";

export interface ManagedConnection {
  ws: WebSocket;
  userId: string;
  connId: string;
  deviceId: string;
  connectedAt: Date;
  jti?: string;        // JWT ID — used to check revocation on heartbeat
  tokenExp?: number;   // Token expiry (Unix seconds) — used for early eviction
}

class ConnectionManager {
  /** connId → connection metadata + live ws */
  private connections = new Map<string, ManagedConnection>();

  /** userId → set of connIds (supports multi-device) */
  private userConnections = new Map<string, Set<string>>();

  /**
   * Register a new WebSocket connection.
   */
  add(conn: ManagedConnection): void {
    this.connections.set(conn.connId, conn);

    let userSet = this.userConnections.get(conn.userId);
    if (!userSet) {
      userSet = new Set();
      this.userConnections.set(conn.userId, userSet);
    }
    userSet.add(conn.connId);

    logger.debug("Connection added to manager", {
      connId: conn.connId,
      userId: conn.userId,
      deviceId: conn.deviceId,
    });
  }

  /**
   * Remove a connection. Returns the removed connection or undefined.
   */
  remove(connId: string): ManagedConnection | undefined {
    const conn = this.connections.get(connId);
    if (!conn) return undefined;

    this.connections.delete(connId);

    const userSet = this.userConnections.get(conn.userId);
    if (userSet) {
      userSet.delete(connId);
      if (userSet.size === 0) {
        this.userConnections.delete(conn.userId);
      }
    }

    logger.debug("Connection removed from manager", {
      connId,
      userId: conn.userId,
    });

    return conn;
  }

  /**
   * Get a connection by connId.
   */
  getByConnId(connId: string): ManagedConnection | undefined {
    return this.connections.get(connId);
  }

  /**
   * Get all connections for a userId (multi-device support).
   * Returns empty array if user has no active connections on this server.
   */
  getByUser(userId: string): ManagedConnection[] {
    const connIds = this.userConnections.get(userId);
    if (!connIds || connIds.size === 0) return [];

    const conns: ManagedConnection[] = [];
    for (const connId of connIds) {
      const conn = this.connections.get(connId);
      if (conn) conns.push(conn);
    }
    return conns;
  }

  /**
   * Send a typed event to a specific connection.
   * Returns true if sent, false if connection is not open.
   */
  sendToConnection(connId: string, envelope: WsEnvelope): boolean {
    const conn = this.connections.get(connId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      conn.ws.send(JSON.stringify(envelope));
      return true;
    } catch (err) {
      logger.warn("Failed to send to connection", {
        connId,
        userId: conn.userId,
        error: err instanceof Error ? err.message : "unknown",
      });
      return false;
    }
  }

  /**
   * Send an event to ALL connections of a user on this server.
   * Returns the number of connections that received the message.
   * Failed sends are logged but do not throw.
   */
  sendToUser(userId: string, envelope: WsEnvelope): number {
    const conns = this.getByUser(userId);
    let sent = 0;

    for (const conn of conns) {
      if (this.sendToConnection(conn.connId, envelope)) {
        sent++;
      }
    }

    return sent;
  }

  /**
   * Send an event to all connections of a user EXCEPT a specific connId.
   * Used to sync a user's other devices (e.g., sender's other devices).
   */
  sendToUserExcept(userId: string, excludeConnId: string, envelope: WsEnvelope): number {
    const conns = this.getByUser(userId);
    let sent = 0;

    for (const conn of conns) {
      if (conn.connId !== excludeConnId) {
        if (this.sendToConnection(conn.connId, envelope)) {
          sent++;
        }
      }
    }

    return sent;
  }

  /**
   * Get all connections (for graceful shutdown).
   */
  getAllConnections(): ManagedConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Total number of active connections on this server.
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Total number of unique users connected to this server.
   */
  get userCount(): number {
    return this.userConnections.size;
  }

  /**
   * Close all connections gracefully (for shutdown).
   */
  closeAll(code = 1001, reason = "Server shutting down"): void {
    for (const conn of this.connections.values()) {
      try {
        conn.ws.close(code, reason);
      } catch {
        // Best effort
      }
    }
    this.connections.clear();
    this.userConnections.clear();
  }
}

// Singleton — one per server process
export const connectionManager = new ConnectionManager();

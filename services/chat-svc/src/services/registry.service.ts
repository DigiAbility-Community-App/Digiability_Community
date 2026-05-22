// ─────────────────────────────────────────────────────────────
// Redis Session Registry Service
//
// Manages the mapping of userId → active WebSocket sessions.
// Each user can have N concurrent sessions across devices.
//
// Data model in Redis:
//   Hash  ws:sessions:{userId}  → { connId1: JSON, connId2: JSON }
//   Set   ws:server:{serverId}  → { connId1, connId2, ... }
//   String ws:presence:{userId} → "online" | ISO timestamp
//
// TTL/heartbeat strategy:
//   - Each ws:sessions:{userId} key has a TTL (default 120s)
//   - ChatSvc refreshes TTL every heartbeat (default 30s)
//   - If a server crashes without cleanup, entries expire naturally
//   - On WS close, entries are removed immediately
// ─────────────────────────────────────────────────────────────

import { redis } from "../config/redis";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { REGISTRY_KEYS } from "../streams/constants";
import { SessionInfo } from "../types/common.types";

export class RegistryService {
  private readonly serverId: string;
  private readonly ttlSeconds: number;

  constructor() {
    this.serverId = env.SERVER_ID;
    this.ttlSeconds = env.REGISTRY_TTL_SECONDS;
  }

  /**
   * Register a new WebSocket connection in the registry.
   * Called when a client successfully upgrades to WebSocket.
   */
  async register(session: SessionInfo): Promise<void> {
    const { userId, connId } = session;
    const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
    const serverKey = REGISTRY_KEYS.SERVER_CONNECTIONS(this.serverId);
    const presenceKey = REGISTRY_KEYS.USER_PRESENCE(userId);

    const pipeline = redis.pipeline();

    // Store session info in user's session hash
    pipeline.hset(userKey, connId, JSON.stringify(session));
    pipeline.expire(userKey, this.ttlSeconds);

    // Track this connection under our server
    pipeline.sadd(serverKey, connId);

    // Mark user as online
    pipeline.set(presenceKey, "online");
    pipeline.expire(presenceKey, this.ttlSeconds);

    await pipeline.exec();

    logger.info("Session registered", {
      userId,
      connId,
      serverId: this.serverId,
      deviceId: session.deviceId,
    });
  }

  /**
   * Remove a connection from the registry.
   * Called on WS close, error, or stale detection.
   */
  async unregister(userId: string, connId: string): Promise<void> {
    const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
    const serverKey = REGISTRY_KEYS.SERVER_CONNECTIONS(this.serverId);
    const presenceKey = REGISTRY_KEYS.USER_PRESENCE(userId);

    const pipeline = redis.pipeline();

    // Remove this specific connection
    pipeline.hdel(userKey, connId);
    pipeline.srem(serverKey, connId);

    await pipeline.exec();

    // Check if user has any remaining sessions
    const remaining = await redis.hlen(userKey);
    if (remaining === 0) {
      // User has no more active connections — mark as offline
      const lastSeen = new Date().toISOString();
      await redis.set(presenceKey, lastSeen);
      // Keep presence key alive for a while so others can see "last seen"
      await redis.expire(presenceKey, 86400); // 24 hours
    }

    logger.info("Session unregistered", { userId, connId, serverId: this.serverId });
  }

  /**
   * Refresh TTL on all keys for a user's sessions.
   * Called on each heartbeat ping from the client.
   */
  async heartbeat(userId: string): Promise<void> {
    const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
    const presenceKey = REGISTRY_KEYS.USER_PRESENCE(userId);

    const pipeline = redis.pipeline();
    pipeline.expire(userKey, this.ttlSeconds);
    pipeline.set(presenceKey, "online");
    pipeline.expire(presenceKey, this.ttlSeconds);
    await pipeline.exec();
  }

  /**
   * Get all active sessions for a user.
   * Used by delivery worker to find where to route messages.
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
    const entries = await redis.hgetall(userKey);

    const sessions: SessionInfo[] = [];
    for (const [, value] of Object.entries(entries)) {
      try {
        sessions.push(JSON.parse(value) as SessionInfo);
      } catch {
        // Corrupted entry — skip
      }
    }

    return sessions;
  }

  /**
   * Check if a user has any active sessions (is online).
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const userKey = REGISTRY_KEYS.USER_SESSIONS(userId);
    const count = await redis.hlen(userKey);
    return count > 0;
  }

  /**
   * Get presence info for a user.
   */
  async getPresence(userId: string): Promise<{ status: "online" | "offline"; lastSeen?: string }> {
    const presenceKey = REGISTRY_KEYS.USER_PRESENCE(userId);
    const value = await redis.get(presenceKey);

    if (!value) {
      return { status: "offline" };
    }

    if (value === "online") {
      return { status: "online" };
    }

    // Value is a timestamp string — user is offline
    return { status: "offline", lastSeen: value };
  }

  /**
   * Get all connection IDs owned by this server.
   * Used during graceful shutdown to clean up all our connections.
   */
  async getServerConnections(): Promise<string[]> {
    const serverKey = REGISTRY_KEYS.SERVER_CONNECTIONS(this.serverId);
    return redis.smembers(serverKey);
  }

  /**
   * Remove all connections owned by this server.
   * Called during graceful shutdown.
   */
  async cleanupServer(): Promise<void> {
    const serverKey = REGISTRY_KEYS.SERVER_CONNECTIONS(this.serverId);
    const connIds = await redis.smembers(serverKey);

    if (connIds.length === 0) return;

    logger.info(`Cleaning up ${connIds.length} connections for server ${this.serverId}`);

    // We don't have userId→connId mapping readily available at server level,
    // so we'll just remove the server key. The per-user entries will expire
    // via TTL. This is acceptable for graceful shutdown.
    await redis.del(serverKey);

    logger.info("Server connection cleanup complete", { serverId: this.serverId });
  }

  /**
   * Remove a stale session entry that was detected during delivery.
   * Called when a WS send fails and we know the connection is dead.
   */
  async removeStaleSession(userId: string, connId: string): Promise<void> {
    logger.warn("Removing stale session", { userId, connId });
    await this.unregister(userId, connId);
  }
}

export const registryService = new RegistryService();

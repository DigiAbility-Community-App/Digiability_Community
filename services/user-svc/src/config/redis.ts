import Redis from "ioredis";

// ─────────────────────────────────────────────────────
// Redis Client — user-svc
// Used for:
//   • Session revocation cache + revocation events (see utils/session-cache.ts)
//   • Rate-limit counters (express-rate-limit store)
// ─────────────────────────────────────────────────────

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");

  _redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 5000),
    lazyConnect: false,
  });

  _redis.on("error", (err) => {
    console.error("[Redis] Connection error:", err.message);
  });

  return _redis;
}

export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit().catch(() => {});
    _redis = null;
  }
}

// ─── Session revocation events ───────────────────────
// Published whenever a session is revoked so services holding live
// connections for it (chat-svc WebSockets) can drop them immediately.

export const SESSION_REVOKED_CHANNEL = "auth:session-revoked";

export async function publishSessionRevoked(sid: string, userId: string): Promise<void> {
  await getRedis().publish(SESSION_REVOKED_CHANNEL, JSON.stringify({ sid, userId }));
}

import Redis from "ioredis";

// ─────────────────────────────────────────────────────
// Optional Redis — forum-svc runs without it.
// When REDIS_URL is set, session revocations from user-svc are seen
// immediately (shared session cache + auth:session-revoked events);
// without it, forum-svc falls back to an in-process cache and sees a
// revocation within ~15s.
// ─────────────────────────────────────────────────────

let _redis: Redis | null | undefined;

export function getOptionalRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    _redis = null;
    return null;
  }
  _redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });
  _redis.on("error", (err) => console.error("[Redis] Connection error:", err.message));
  return _redis;
}

/** A separate connection for SUBSCRIBE (a subscribed client can't run commands). */
export function createOptionalSubscriber(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const sub = new Redis(url, { retryStrategy: (times) => Math.min(times * 200, 5000) });
  sub.on("error", (err) => console.error("[Redis sub] Connection error:", err.message));
  return sub;
}

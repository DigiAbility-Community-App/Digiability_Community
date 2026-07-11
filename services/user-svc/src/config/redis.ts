import Redis from "ioredis";

// ─────────────────────────────────────────────────────
// Redis Client — user-svc
// Used for:
//   • JTI revocation blocklist (access token invalidation)
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

// ─── JTI blocklist helpers ────────────────────────────

const JTI_PREFIX = "revoked:jti:";

/**
 * Add a JTI to the revocation set. TTL = remaining token lifetime so
 * the key expires automatically after the token would have expired anyway.
 */
export async function revokeJti(jti: string, ttlSeconds: number): Promise<void> {
  if (ttlSeconds <= 0) return;
  await getRedis().set(`${JTI_PREFIX}${jti}`, "1", "EX", ttlSeconds);
}

/**
 * Returns true if the JTI has been explicitly revoked before expiry.
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  const val = await getRedis().get(`${JTI_PREFIX}${jti}`);
  return val === "1";
}

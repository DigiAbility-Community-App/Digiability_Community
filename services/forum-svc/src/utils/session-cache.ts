
// ─────────────────────────────────────────────────────
// Session revocation cache (VAPT M-003 / CWE-613)
//
// Every access token carries a `sid`. A request is only allowed while that
// session is active, which makes logout take effect immediately instead of
// when the token expires. To avoid a DB hit per request, the state is cached:
//
//   • Redis (shared by all instances) when available — `auth:session:{sid}` is
//     "active" for a short TTL, or "revoked" until every token for that sid
//     has expired. Revocation writes "revoked" straight away, so it is
//     visible to every instance on the very next request.
//   • An in-process LRU otherwise (or alongside Redis). Without Redis a
//     revocation made by another process reaches this one within the
//     active TTL.
//
// Any cache failure falls through to the database — fail-safe, never
// fail-open. This file is duplicated per service (services share no source);
// keep the copies in step.
// ─────────────────────────────────────────────────────

type SessionState = "active" | "revoked";

/** The two Redis commands the cache needs (an ioredis client satisfies this). */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
}

export interface SessionCacheOptions {
  /** Returns the shared Redis client, or null when the service has none. */
  getRedis: () => RedisLike | null;
  /** Source of truth: true when the session exists, is not revoked and not expired. */
  lookup: (sid: string) => Promise<boolean>;
  /** How long an "active" answer may be reused. */
  activeTtlSeconds: number;
  /** How long a "revoked" answer is kept — at least the access-token lifetime. */
  revokedTtlSeconds: number;
  maxLocalEntries?: number;
}

const REDIS_TIMEOUT_MS = 300;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("session cache timeout")), REDIS_TIMEOUT_MS)
    ),
  ]);
}

export function createSessionCache(opts: SessionCacheOptions) {
  const maxEntries = opts.maxLocalEntries ?? 5000;
  const local = new Map<string, { state: SessionState; expiresAt: number }>();

  function remember(sid: string, state: SessionState): void {
    const ttl = state === "active" ? opts.activeTtlSeconds : opts.revokedTtlSeconds;
    local.delete(sid); // re-insert so Map order tracks recency
    local.set(sid, { state, expiresAt: Date.now() + ttl * 1000 });
    if (local.size > maxEntries) {
      const oldest = local.keys().next().value;
      if (oldest !== undefined) local.delete(oldest);
    }
  }

  function recall(sid: string): SessionState | null {
    const hit = local.get(sid);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      local.delete(sid);
      return null;
    }
    return hit.state;
  }

  function redisOrNull(): RedisLike | null {
    try {
      return opts.getRedis();
    } catch {
      return null;
    }
  }

  async function writeRedis(redis: RedisLike, sid: string, state: SessionState): Promise<void> {
    const ttl = state === "active" ? opts.activeTtlSeconds : opts.revokedTtlSeconds;
    await withTimeout(redis.set(`auth:session:${sid}`, state, "EX", ttl)).catch(() => {});
  }

  async function isSessionActive(sid: string): Promise<boolean> {
    const localState = recall(sid);
    if (localState === "revoked") return false;

    const redis = redisOrNull();
    if (redis) {
      try {
        const shared = await withTimeout(redis.get(`auth:session:${sid}`));
        if (shared === "revoked") {
          remember(sid, "revoked");
          return false;
        }
        if (shared === "active") return true;
      } catch {
        // fall through to the database
      }
    } else if (localState === "active") {
      return true;
    }

    const active = await opts.lookup(sid);
    const state: SessionState = active ? "active" : "revoked";
    remember(sid, state);
    if (redis) await writeRedis(redis, sid, state);
    return active;
  }

  async function markSessionRevoked(sid: string): Promise<void> {
    remember(sid, "revoked");
    const redis = redisOrNull();
    if (redis) await writeRedis(redis, sid, "revoked");
  }

  return { isSessionActive, markSessionRevoked };
}

/** Seconds in a jsonwebtoken-style duration ("10m", "1h", "900"). */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d)?$/.exec(value.trim());
  if (!match) return 86400; // unparseable: err long, it only bounds a cache entry
  const n = parseInt(match[1], 10);
  const unit = match[2] ?? "s";
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
}

import prisma from "../models/prisma.client";
import { redis } from "../config/redis";
import { createSessionCache } from "../utils/session-cache";

// Is the login session behind an access token still active? Sessions live in
// user-svc's `public.sessions` table; chat-svc's Prisma client is on the
// `chat` schema, so it is read with raw SQL (same database, one indexed row).
// user-svc writes "revoked" into the shared Redis cache the moment a session
// ends, so a logout is seen here on the very next request.
const cache = createSessionCache({
  getRedis: () => redis,
  lookup: async (sid) => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok FROM public.sessions
      WHERE id = ${sid} AND "revokedAt" IS NULL AND "expiresAt" > now()
      LIMIT 1
    `;
    return rows.length > 0;
  },
  activeTtlSeconds: 30,
  // Comfortably longer than any access-token lifetime; only bounds the entry.
  revokedTtlSeconds: 3600,
});

export const isSessionActive = cache.isSessionActive;

/** Published by user-svc whenever a session is revoked. */
export const SESSION_REVOKED_CHANNEL = "auth:session-revoked";

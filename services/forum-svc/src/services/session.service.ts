import prisma from "../models/prisma.client";
import { getOptionalRedis } from "../config/redis";
import { createSessionCache } from "../utils/session-cache";

// Is the login session behind an access token still active? `sessions` is
// owned by user-svc in the shared `public` schema (stub model in this
// service's schema.prisma). With REDIS_URL set this shares user-svc's cache
// and sees a logout immediately; without it an "active" answer is reused for
// at most 15s.
const cache = createSessionCache({
  getRedis: getOptionalRedis,
  lookup: async (sid) =>
    (await prisma.session.count({
      where: { id: sid, revokedAt: null, expiresAt: { gt: new Date() } },
    })) > 0,
  activeTtlSeconds: 15,
  // Comfortably longer than any access-token lifetime; only bounds the entry.
  revokedTtlSeconds: 3600,
});

export const isSessionActive = cache.isSessionActive;

/** Published by user-svc whenever a session is revoked. */
export const SESSION_REVOKED_CHANNEL = "auth:session-revoked";

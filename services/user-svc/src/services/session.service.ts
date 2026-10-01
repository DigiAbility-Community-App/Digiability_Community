import prisma from "../models/prisma.client";
import { getRedis } from "../config/redis";
import { ACCESS_TOKEN_TTL } from "../utils/jwt.util";
import { createSessionCache, durationToSeconds } from "../utils/session-cache";

// Session state as seen by this service's auth middleware. Revocation itself
// lives in token.service.ts, which calls markSessionRevoked().
const cache = createSessionCache({
  getRedis,
  lookup: async (sid) =>
    (await prisma.session.count({
      where: { id: sid, revokedAt: null, expiresAt: { gt: new Date() } },
    })) > 0,
  activeTtlSeconds: 30,
  revokedTtlSeconds: durationToSeconds(ACCESS_TOKEN_TTL) + 60,
});

export const isSessionActive = cache.isSessionActive;
export const markSessionRevoked = cache.markSessionRevoked;

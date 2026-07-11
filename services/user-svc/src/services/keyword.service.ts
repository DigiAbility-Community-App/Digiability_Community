import prisma from "../models/prisma.client";
import { getRedis } from "../config/redis";
import { createError } from "../middleware/error.middleware";
import { KeywordAction, KeywordCategory, KeywordMatchType, KeywordSeverity } from "../generated/client";

// ─────────────────────────────────────────────────────
// Keyword Service
//
// Single source of truth for the banned-keyword list.
// All writes go through here so the Redis cache stays
// consistent and all consumers are notified via pub/sub.
//
// Cache layout:
//   mod:keywords:active  →  JSON array of KeywordCacheEntry
//
// Pub/sub notification:
//   channel: mod:keywords:updated
//   message: "" (subscribers just need the signal to reload)
// ─────────────────────────────────────────────────────

export const CACHE_KEY = "mod:keywords:active";
export const PUBSUB_CHANNEL = "mod:keywords:updated";

export interface KeywordCacheEntry {
  phrase: string;
  action: "flag" | "block";
  matchType: "EXACT" | "CONTAINS";
}

// ─── Cache helpers ────────────────────────────────────

async function refreshCache(): Promise<void> {
  const keywords = await prisma.bannedKeyword.findMany({
    where: { isActive: true },
    select: { phrase: true, action: true, matchType: true },
  });

  const entries: KeywordCacheEntry[] = keywords.map((k) => ({
    phrase: k.phrase,
    action: k.action as "flag" | "block",
    matchType: k.matchType as "EXACT" | "CONTAINS",
  }));

  const redis = getRedis();
  await redis.set(CACHE_KEY, JSON.stringify(entries));
  await redis.publish(PUBSUB_CHANNEL, "");
}

/** Load keywords from DB into Redis on service boot. */
export async function initKeywordCache(): Promise<void> {
  await refreshCache();
}

// ─── CRUD ─────────────────────────────────────────────

export interface CreateKeywordInput {
  phrase: string;
  severity?: KeywordSeverity;
  action?: KeywordAction;
  category?: KeywordCategory;
  matchType?: KeywordMatchType;
  createdBy?: string;
}

export async function createKeyword(input: CreateKeywordInput) {
  const existing = await prisma.bannedKeyword.findUnique({
    where: { phrase: input.phrase.toLowerCase().trim() },
  });
  if (existing) throw createError("This phrase is already in the keyword list.", 409);

  const keyword = await prisma.bannedKeyword.create({
    data: {
      phrase: input.phrase.toLowerCase().trim(),
      severity: input.severity ?? KeywordSeverity.MEDIUM,
      action: input.action ?? KeywordAction.block,
      category: input.category ?? KeywordCategory.OTHER,
      matchType: input.matchType ?? KeywordMatchType.CONTAINS,
      createdBy: input.createdBy,
    },
  });

  await refreshCache();
  return keyword;
}

export async function listKeywords(opts: { category?: string; isActive?: boolean } = {}) {
  return prisma.bannedKeyword.findMany({
    where: {
      ...(opts.category ? { category: opts.category as KeywordCategory } : {}),
      ...(opts.isActive !== undefined ? { isActive: opts.isActive } : {}),
    },
    orderBy: [{ category: "asc" }, { phrase: "asc" }],
  });
}

export async function updateKeyword(
  id: string,
  data: Partial<{
    phrase: string;
    severity: KeywordSeverity;
    action: KeywordAction;
    category: KeywordCategory;
    matchType: KeywordMatchType;
    isActive: boolean;
  }>
) {
  const keyword = await prisma.bannedKeyword.findUnique({ where: { id } });
  if (!keyword) throw createError("Keyword not found.", 404);

  const updated = await prisma.bannedKeyword.update({
    where: { id },
    data: {
      ...data,
      ...(data.phrase ? { phrase: data.phrase.toLowerCase().trim() } : {}),
      updatedAt: new Date(),
    },
  });

  await refreshCache();
  return updated;
}

export async function deleteKeyword(id: string) {
  const keyword = await prisma.bannedKeyword.findUnique({ where: { id } });
  if (!keyword) throw createError("Keyword not found.", 404);

  await prisma.bannedKeyword.delete({ where: { id } });
  await refreshCache();
  return { message: "Keyword deleted." };
}

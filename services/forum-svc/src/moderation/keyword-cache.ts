// ─────────────────────────────────────────────────────
// Keyword Cache — forum-svc
// Loads the active keyword list from Redis on boot,
// then hot-reloads whenever user-svc publishes
// mod:keywords:updated to the pub/sub channel.
// ─────────────────────────────────────────────────────

import Redis from "ioredis";
import { buildKeywordMatcher, KeywordMatcher, KeywordEntry } from "@digiability/moderation";

const CACHE_KEY = "mod:keywords:active";
const PUBSUB_CHANNEL = "mod:keywords:updated";

class KeywordCache {
  private matcher: KeywordMatcher | null = null;
  private cmd: Redis | null = null;   // command client
  private sub: Redis | null = null;   // subscriber client

  async init(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return;

    // One command client for GET operations
    this.cmd = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (t) => Math.min(t * 200, 5000),
      lazyConnect: false,
    });
    this.cmd.on("error", () => {});

    await this.reload();

    // Dedicated subscriber client (ioredis can't issue commands in subscribe mode)
    this.sub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (t) => Math.min(t * 200, 5000),
      lazyConnect: false,
    });
    this.sub.on("error", () => {});

    await this.sub.subscribe(PUBSUB_CHANNEL);
    this.sub.on("message", () => {
      this.reload().catch(() => {});
    });
  }

  private async reload(): Promise<void> {
    if (!this.cmd) return;
    try {
      const raw = await this.cmd.get(CACHE_KEY);
      const entries: KeywordEntry[] = raw ? JSON.parse(raw) : [];
      this.matcher = buildKeywordMatcher(entries);
    } catch {
      // Non-fatal — keep previous matcher
    }
  }

  getMatcher(): KeywordMatcher | null {
    return this.matcher;
  }

  async destroy(): Promise<void> {
    await Promise.all([
      this.cmd?.quit().catch(() => {}),
      this.sub?.quit().catch(() => {}),
    ]);
  }
}

export const keywordCache = new KeywordCache();

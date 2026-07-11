// ─────────────────────────────────────────────────────
// Keyword Cache — chat-svc
//
// Maintains an in-memory compiled KeywordMatcher that is
// rebuilt whenever user-svc publishes mod:keywords:updated
// to Redis pub/sub.
//
// Usage:
//   await keywordCache.init();            // at service boot
//   keywordCache.getMatcher()             // in message handler
// ─────────────────────────────────────────────────────

import Redis from "ioredis";
import { buildKeywordMatcher, KeywordMatcher, KeywordEntry } from "@digiability/moderation";
import { env } from "../config/env";
import { logger } from "../config/logger";

const CACHE_KEY = "mod:keywords:active";
const PUBSUB_CHANNEL = "mod:keywords:updated";

class KeywordCache {
  private matcher: KeywordMatcher | null = null;
  private sub: Redis | null = null;

  /** Load keyword list from Redis and subscribe to invalidation channel. */
  async init(): Promise<void> {
    await this.reload();

    // Dedicated subscriber connection (ioredis requirement: subscribe mode
    // can't issue commands on the same connection).
    this.sub = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (t) => Math.min(t * 200, 5000),
      lazyConnect: false,
    });

    this.sub.on("error", (err) =>
      logger.warn("Keyword cache pub/sub error", { error: err.message })
    );

    await this.sub.subscribe(PUBSUB_CHANNEL);
    this.sub.on("message", (_ch: string, _msg: string) => {
      this.reload().catch((err) =>
        logger.warn("Keyword cache reload failed", { error: err.message })
      );
    });

    logger.info("Keyword cache initialised", {
      size: this.matcher?.isEmpty === false ? "non-empty" : "empty",
    });
  }

  private async reload(): Promise<void> {
    // Import the redis command client lazily to avoid circular deps
    const { redis } = await import("../config/redis");
    const raw = await redis.get(CACHE_KEY).catch(() => null);

    if (!raw) {
      this.matcher = null;
      return;
    }

    const entries = JSON.parse(raw) as KeywordEntry[];
    this.matcher = buildKeywordMatcher(entries);
  }

  getMatcher(): KeywordMatcher | null {
    return this.matcher;
  }

  async destroy(): Promise<void> {
    await this.sub?.quit().catch(() => {});
  }
}

export const keywordCache = new KeywordCache();

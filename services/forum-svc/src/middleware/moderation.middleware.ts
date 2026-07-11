import { Request, Response, NextFunction } from "express";
import { screenText } from "@digiability/moderation";
import { keywordCache } from "../moderation/keyword-cache";
import Redis from "ioredis";

// ─────────────────────────────────────────────────────
// Forum Moderation Middleware (Tier A — synchronous)
//
// Screens the user-supplied text fields of a request before
// the controller runs. Hard blocks are rejected with 422 so
// the controller never sees the content.
//
// For questions: screens `title` and `description`.
// For answers:   screens `content`.
//
// "flag" results are logged for future async review (Tier C).
// "block" results return a user-friendly 422 response.
// ─────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      lazyConnect: true,
    });
    _redis.on("error", () => {}); // silence connection errors — counter is non-critical
  }
  return _redis;
}

function blockedCounterKey(): string {
  return `mod:blocked:forum:${new Date().toISOString().slice(0, 10)}`;
}

function incrementBlocked(): void {
  const r = getRedis();
  if (!r) return;
  r.incr(blockedCounterKey())
    .then(() => r.expire(blockedCounterKey(), 30 * 24 * 3600))
    .catch(() => {});
}

/**
 * Collects the text fields to screen depending on the route.
 * Works for both question payloads (title + description) and
 * answer payloads (content).
 */
function extractText(body: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof body.title === "string") parts.push(body.title);
  if (typeof body.description === "string") parts.push(body.description);
  if (typeof body.content === "string") parts.push(body.content);
  return parts.join(" ");
}

export function moderateContent(req: Request, res: Response, next: NextFunction): void {
  const text = extractText(req.body as Record<string, unknown>);

  if (!text.trim()) {
    next();
    return;
  }

  const result = screenText(text, {
    context: "forum",
    keywordMatcher: keywordCache.getMatcher(),
  });

  if (result.action === "block") {
    console.error("[Moderation] Forum content blocked", {
      userId: (req as any).user?.sub,
      path: req.path,
      reasons: result.reasons,
    });
    incrementBlocked();
    res.status(422).json({
      success: false,
      message:
        "Your post was blocked because it violates community guidelines. " +
        "Please review our community standards and try again.",
      code: "CONTENT_BLOCKED",
    });
    return;
  }

  if (result.action === "flag") {
    console.warn("[Moderation] Forum content flagged for review", {
      userId: (req as any).user?.sub,
      path: req.path,
      reasons: result.reasons,
    });
    // Attach for Tier C ModerationFlag write in controller (non-blocking)
    (req as any).moderationFlag = { reasons: result.reasons, normalized: result.normalized };
  }

  next();
}

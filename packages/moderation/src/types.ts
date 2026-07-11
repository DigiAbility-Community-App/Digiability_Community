// ─────────────────────────────────────────────────────
// Moderation Types
// ─────────────────────────────────────────────────────

/**
 * Moderation verdict for a piece of content.
 *   allow  — clean, publish as-is
 *   flag   — suspicious (spam links, phone numbers); publish but enqueue for human review
 *   block  — contains profanity or banned keywords; reject immediately
 */
export type ModerationAction = "allow" | "flag" | "block";

/** Result returned by screenText() */
export interface ScreenResult {
  action: ModerationAction;
  /** Human-readable reasons for a non-allow verdict (empty when action is allow) */
  reasons: string[];
  /** The normalised text that was fed into the matchers — useful for logging */
  normalized: string;
}

/** Optional per-call overrides */
export interface ScreenOptions {
  /**
   * Pre-compiled keyword matcher from the DB-backed keyword list (Tier B).
   * Pass null or omit to skip keyword matching (Tier A behaviour).
   * Build with buildKeywordMatcher() from packages/moderation.
   */
  keywordMatcher?: import("./keyword-matcher").KeywordMatcher | null;
  /** Hint about where the content originates — may affect thresholds in future tiers */
  context?: "chat" | "forum" | "profile";
}

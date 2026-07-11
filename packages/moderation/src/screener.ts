// ─────────────────────────────────────────────────────
// Content Screener
//
// screenText() is the single public entry point for all
// synchronous moderation. Three checks run in order:
//
//   1. Profanity — `obscenity` + our normalization layer
//   2. Banned keywords — pre-compiled KeywordMatcher (Tier B)
//   3. Regex patterns — invite links, URLs, phone numbers
//
// Precedence: block > flag > allow.
// ─────────────────────────────────────────────────────

import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { normalize } from "./normalize";
import { matchPatterns } from "./patterns";
import type { ModerationAction, ScreenOptions, ScreenResult } from "./types";

// Built once at module load — expensive to construct but thread-safe to reuse.
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

function worst(a: ModerationAction, b: ModerationAction): ModerationAction {
  if (a === "block" || b === "block") return "block";
  if (a === "flag" || b === "flag") return "flag";
  return "allow";
}

/**
 * Screen a text string for policy violations.
 *
 * @param text  Raw user input (message content, post body, etc.)
 * @param opts  Optional compiled keyword matcher and context hint
 */
export function screenText(text: string, opts: ScreenOptions = {}): ScreenResult {
  if (!text || text.trim().length === 0) {
    return { action: "allow", reasons: [], normalized: "" };
  }

  const normalized = normalize(text);
  const reasons: string[] = [];
  let action: ModerationAction = "allow";

  // ── 1. Profanity (obscenity) ───────────────────────────────
  // Run on both original (obscenity's own transformers) and normalised
  // (our pipeline catches diacritics, zero-width, separators).
  if (profanityMatcher.hasMatch(text) || profanityMatcher.hasMatch(normalized)) {
    reasons.push("profanity");
    action = "block";
  }

  // ── 2. Custom keyword matcher (Tier B, optional) ───────────
  const km = opts.keywordMatcher;
  if (km && !km.isEmpty) {
    // Check both original and normalised forms
    const hit = km.check(text) ?? km.check(normalized);
    if (hit) {
      reasons.push(`banned-keyword:${hit.matched}`);
      action = worst(action, hit.action);
    }
  }

  // ── 3. Regex patterns (links, phones) ─────────────────────
  const patternReasons = [...new Set([
    ...matchPatterns(text),
    ...matchPatterns(normalized),
  ])];

  if (patternReasons.length > 0) {
    reasons.push(...patternReasons);
    action = worst(action, "flag");
  }

  return { action, reasons, normalized };
}

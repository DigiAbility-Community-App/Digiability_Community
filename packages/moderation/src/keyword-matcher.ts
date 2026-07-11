// ─────────────────────────────────────────────────────
// KeywordMatcher
//
// Compiles a list of banned phrases into two RegExps
// (one for "block", one for "flag") so matching is O(text)
// instead of O(phrases × text) regardless of list size.
//
// Called once when the keyword list changes; the compiled
// matcher is cached by the service (chat-svc, forum-svc)
// and reused for every message until the next invalidation.
// ─────────────────────────────────────────────────────

import type { ModerationAction } from "./types";

export interface KeywordEntry {
  phrase: string;
  action: ModerationAction;
  matchType: "EXACT" | "CONTAINS";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPattern(entry: KeywordEntry): string {
  const escaped = escapeRegex(entry.phrase);
  return entry.matchType === "EXACT" ? `\\b${escaped}\\b` : escaped;
}

export class KeywordMatcher {
  private readonly blockRe: RegExp | null;
  private readonly flagRe: RegExp | null;

  constructor(keywords: KeywordEntry[]) {
    const blockEntries = keywords.filter((k) => k.action === "block");
    const flagEntries = keywords.filter((k) => k.action === "flag");

    this.blockRe =
      blockEntries.length > 0
        ? new RegExp(blockEntries.map(buildPattern).join("|"), "i")
        : null;

    this.flagRe =
      flagEntries.length > 0
        ? new RegExp(flagEntries.map(buildPattern).join("|"), "i")
        : null;
  }

  /** Returns the matched phrase + action, or null if no match. */
  check(text: string): { action: ModerationAction; matched: string } | null {
    if (this.blockRe) {
      const m = text.match(this.blockRe);
      if (m) return { action: "block", matched: m[0] };
    }
    if (this.flagRe) {
      const m = text.match(this.flagRe);
      if (m) return { action: "flag", matched: m[0] };
    }
    return null;
  }

  get isEmpty(): boolean {
    return this.blockRe === null && this.flagRe === null;
  }
}

/**
 * Convenience factory — use when you have a raw JSON array
 * from Redis (services deserialise and pass it here).
 */
export function buildKeywordMatcher(entries: KeywordEntry[]): KeywordMatcher | null {
  if (entries.length === 0) return null;
  return new KeywordMatcher(entries);
}

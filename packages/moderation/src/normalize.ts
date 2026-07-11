// ─────────────────────────────────────────────────────
// Text Normalization Pipeline
//
// Collapses common evasion techniques so matchers see
// a canonical form regardless of how the user typed it.
//
// Steps (in order):
//   1. Lowercase
//   2. NFKD decompose → strip Unicode combining marks (diacritics)
//   3. Remove zero-width / invisible characters
//   4. Leet-speak substitution (@→a, 0→o, 1→i, etc.)
//   5. Strip inter-character separators (f.u.c.k → fuck)
//   6. Collapse 3+ repeated characters → 2 (fuuuuck → fuuck)
// ─────────────────────────────────────────────────────

/** Characters that appear between letters to defeat word matching */
const SEPARATOR_RE = /[\s.\-_*,]+/g;

/** Leet-speak character map */
const LEET: Record<string, string> = {
  "@": "a",
  "4": "a",
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "$": "s",
  "5": "s",
  "7": "t",
};

/**
 * Build the leet-substitution regex once (keys are single chars, safe to join).
 * Escapes `$` (regex meta char in character classes).
 */
const LEET_KEYS = Object.keys(LEET).map((k) => k.replace(/[$|]/g, "\\$&")).join("");
const LEET_RE = new RegExp(`[${LEET_KEYS}]`, "g");

/**
 * Zero-width and invisible Unicode characters used to split words:
 *   U+200B  ZERO WIDTH SPACE
 *   U+200C  ZERO WIDTH NON-JOINER
 *   U+200D  ZERO WIDTH JOINER
 *   U+200E  LEFT-TO-RIGHT MARK
 *   U+200F  RIGHT-TO-LEFT MARK
 *   U+2060  WORD JOINER
 *   U+2061–U+2064  invisible math operators
 *   U+206A–U+206F  deprecated format characters
 *   U+FEFF  ZERO WIDTH NO-BREAK SPACE (BOM)
 *   U+00AD  SOFT HYPHEN
 */
const ZERO_WIDTH_RE = /[​-‏⁠-⁯﻿­]/g;

/**
 * Detect single-character sequences separated by punctuation/spaces:
 * "f.u.c.k" or "f u c k" or "f-u-c-k".
 *
 * Strategy: if a run of (char)(sep)(char)(sep)… matches a min-length
 * word when separators are removed, strip all separators inside it.
 * We use a two-pass approach: first build a separator-stripped version,
 * then use it for matching alongside the original.
 */
function stripInterCharSeparators(text: string): string {
  // Replace any punctuation/space that sits between two single word chars.
  // This regex looks ahead/behind for a word character with nothing else
  // (i.e. the adjacent chars are isolated letters, not part of real words).
  //
  // Approach: repeatedly remove any separator that is both preceded and
  // followed by exactly one word character with no adjacent word chars.
  // Simpler: replace (letter)(separators)(letter) → (letter)(letter)
  // when the run length around the letter is exactly 1.
  // We approximate by stripping all sequences like "X[sep]+Y" where X,Y
  // are alphanumerics and the separator contains only our target chars.
  return text.replace(/([a-z0-9])([\s.\-_*,]+)(?=[a-z0-9])/g, (_, ch) => ch);
}

/**
 * Normalize text for moderation matching.
 * Returns a canonical lower-case ASCII-like string.
 */
export function normalize(text: string): string {
  // 1. Lowercase
  let t = text.toLowerCase();

  // 2. NFKD decompose and strip combining diacritical marks (category Mn)
  t = t.normalize("NFKD").replace(/\p{Mn}/gu, "");

  // 3. Remove zero-width / invisible chars
  t = t.replace(ZERO_WIDTH_RE, "");

  // 4. Leet-speak substitution
  t = t.replace(LEET_RE, (ch) => LEET[ch] ?? ch);

  // 5. Strip inter-character separators (f.u.c.k → fuck)
  //    Run twice: first pass catches alternating pairs, second catches residuals
  t = stripInterCharSeparators(t);
  t = stripInterCharSeparators(t);

  // 6. Collapse 3+ consecutive identical chars to 2 (fuuuuck → fuuck)
  t = t.replace(/(.)\1{2,}/g, "$1$1");

  return t.trim();
}

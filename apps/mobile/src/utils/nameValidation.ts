// ─────────────────────────────────────────────────────────────
// Shared validation for "name of a person" text fields (signup, profile
// completion, care-person name, etc.) — single source of truth so every
// name field enforces the identical rules.
//
// Two separate concerns, checked at two different points:
//   - sanitizeNameInput: which CHARACTERS are allowed, enforced live on
//     every keystroke (letters, marks, whitespace, hyphen, apostrophe).
//   - isValidNameFormat: how those characters are ARRANGED, checked at
//     submit/save time — rejects "Y---- T---" while still allowing
//     "Anne-Marie" or "O'Brien".
// ─────────────────────────────────────────────────────────────

/**
 * Strip everything except letters, combining marks, whitespace, hyphens,
 * and apostrophes from a name input. `\p{M}` (combining marks) is included
 * alongside `\p{L}` (letters) deliberately — many Indian scripts
 * (Devanagari, Tamil, etc.) render vowel signs and other diacritics as
 * separate combining-mark code points, not as part of the base letter.
 * Without `\p{M}`, a name like "राज कुमार" gets silently mangled to
 * "रज कमर" — the base consonants survive but the vowel signs are stripped
 * as if they were symbols. Hyphens/apostrophes are allowed here (unlike
 * digits/underscores/other symbols) so real names like "Anne-Marie" or
 * "O'Brien" can actually be typed — isValidNameFormat is what catches an
 * invalid *arrangement* of them, not this character-level filter.
 */
export function sanitizeNameInput(raw: string): string {
  return raw.replace(/[^\p{L}\p{M}\s'-]/gu, "");
}

/**
 * Shape-level check for a name, run at submit/save time (not on every
 * keystroke): rejects consecutive hyphens/apostrophes in any combination
 * ("Y---- T---", "O''Brien", "Anne-'Marie") and a name that starts or ends
 * with a hyphen or apostrophe ("-Anne", "Anne-"). Doesn't check length —
 * callers that care about a minimum/maximum check that separately, since
 * "must be at least 2 characters" is a more useful message to show a user
 * than a generic "invalid format" would be.
 */
export function isValidNameFormat(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/[-']{2,}/.test(trimmed)) return false;
  if (/^[-']|[-']$/.test(trimmed)) return false;
  return true;
}

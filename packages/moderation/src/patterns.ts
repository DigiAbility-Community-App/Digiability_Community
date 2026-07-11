// ─────────────────────────────────────────────────────
// Moderation Regex Patterns
//
// These patterns flag content for human review (action = "flag")
// rather than hard-blocking it. Spam links and phone numbers
// are common vectors for external solicitation; blocking them
// outright would false-positive too often (e.g. a therapist
// sharing their clinic URL in a care circle).
// ─────────────────────────────────────────────────────

/**
 * Common invite-link patterns for third-party platforms.
 * These are more suspicious than generic URLs because they
 * suggest the user is trying to move community members off-platform.
 */
export const INVITE_LINK_RE =
  /(?:discord\.gg|t\.me|telegram\.me|wa\.me|whatsapp\.com\/invite|join\.skype|signal\.group)\/[A-Za-z0-9_\-+%]{3,}/i;

/**
 * Generic HTTP/HTTPS URLs (any domain).
 * Less suspicious than invite links but still worth flagging in
 * a community where users may not be expecting external links.
 */
export const URL_RE = /https?:\/\/[^\s<>"]{4,}/i;

/**
 * Common URL shorteners — often used to obscure destination.
 */
export const SHORT_URL_RE =
  /(?:bit\.ly|tinyurl\.com|goo\.gl|ow\.ly|t\.co|buff\.ly|rb\.gy|cutt\.ly)\/[A-Za-z0-9_\-]{2,}/i;

/**
 * Phone numbers — sequences of 10+ digits (with optional separators).
 * Matches formats: +91-9876543210, (123) 456-7890, 9876543210, etc.
 */
export const PHONE_RE =
  /(?:\+?[0-9][\s\-.()*]*){10,}/;

/**
 * Evaluate a (possibly normalized) text string against all patterns.
 * Returns an array of matched reason strings (empty = no match).
 */
export function matchPatterns(text: string): string[] {
  const reasons: string[] = [];

  if (INVITE_LINK_RE.test(text)) reasons.push("invite-link");
  else if (SHORT_URL_RE.test(text)) reasons.push("shortened-url");
  else if (URL_RE.test(text)) reasons.push("external-link");

  if (PHONE_RE.test(text)) reasons.push("phone-number");

  return reasons;
}

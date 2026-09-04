// ─────────────────────────────────────────────────────────────
// Shared validation rules used by both the client form and the API routes
// it posts to — a single source of truth so client-side UX checks and
// server-side enforcement can't drift apart into two different rules.
// ─────────────────────────────────────────────────────────────

export const INVALID_PHONE_MESSAGE = "Please enter a valid phone number.";

/**
 * Indian mobile number: optional +91/91 prefix, then exactly 10 digits
 * starting with 6-9 (the valid leading digits for Indian mobile numbers).
 * Spaces, hyphens, and parentheses are ignored before matching. An empty
 * value is valid — contact phone is an optional field.
 */
export function isValidIndianPhone(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined || raw.trim() === "") return true;
  const digits = raw.replace(/[\s\-()]/g, "");
  return /^(\+?91)?[6-9]\d{9}$/.test(digits);
}

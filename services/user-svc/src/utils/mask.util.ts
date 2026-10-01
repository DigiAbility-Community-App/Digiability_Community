// ─────────────────────────────────────────────────────
// Display masking
//
// The member picker (new chat, create group, add to group — six screens across
// mobile and web) shows a user's email under their name. That is how you tell
// two people called "Priya Sharma" apart, so the field cannot simply be
// removed. But returning full addresses for any name anyone types is a
// harvesting surface: search "a", get twenty real email addresses.
//
// Masking keeps the disambiguation and drops the harvest value.
// ─────────────────────────────────────────────────────

/**
 * Mask an email for display: `priya.sharma@gmail.com` → `pr•••a@gmail.com`.
 *
 * Deliberately different from `maskEmail` in audit.service, which produces
 * `***@domain` — correct for a log line, but it would render every Gmail user
 * identically in a picker and defeat the purpose.
 *
 * Short local parts are masked entirely rather than revealing most of a
 * two-character name.
 */
export function maskEmailForDisplay(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 1) return "•••";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length <= 3) return `•••@${domain}`;
  return `${local.slice(0, 2)}•••${local.slice(-1)}@${domain}`;
}

// ─────────────────────────────────────────────────────────────
// Shared validation for username fields (profile completion, Edit
// Profile) — single source of truth so every username field enforces the
// identical rule. The charset/length envelope alone previously allowed a
// username of only underscores/periods (e.g. "_____") to pass, since
// nothing required any actual letters or digits to be present.
// ─────────────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_.]{1,15}$/;
const MIN_ALNUM = 3;

/** Shape check: 1-15 chars from the allowed set, with at least 3 letters/digits. */
export function isValidUsernameFormat(value: string): boolean {
  if (!USERNAME_REGEX.test(value)) return false;
  const alnumCount = (value.match(/[a-zA-Z0-9]/g) ?? []).length;
  return alnumCount >= MIN_ALNUM;
}

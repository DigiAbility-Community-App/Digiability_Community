// ─────────────────────────────────────────────────────────────
// Shared validation for Indian mobile number fields (signup, profile
// completion, Edit Profile) — single source of truth so every mobile
// field enforces the identical rule. Previously each screen carried its
// own copy and drifted: Tell Us About Yourself accepted 10-15 digits with
// +/-/() symbols, well past what signup and the backend actually accept.
// ─────────────────────────────────────────────────────────────

/**
 * Strip to digits only, on every keystroke. Also collapses a leading
 * country-code prefix ("91"/"+91") down to the bare 10-digit number — the
 * stripping only triggers once there are MORE than 10 digits, so a
 * genuine 10-digit number that happens to start with "91" is untouched.
 */
export function sanitizeMobileInput(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(digits.length - 10);
  }
  return digits.slice(0, 10);
}

/** Shape check at submit/save time: exactly 10 digits, starting 6-9. */
export function isValidMobileFormat(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

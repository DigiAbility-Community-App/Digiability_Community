// ─────────────────────────────────────────────────────────────
// Shared validation for free-text location fields (Address Line 1,
// Street/Area, City, District, State) across profile completion and Edit
// Profile. These fields previously had no format validation anywhere in
// the app, so pure-numeric garbage (e.g. "152562782" typed into City)
// passed straight through.
// ─────────────────────────────────────────────────────────────

/**
 * Rejects a value that's pure digits/symbols with no letters at all.
 * Applies uniformly to Address Line 1, Street/Area, City, District, and
 * State — this still allows "42 MG Road" (has letters) while rejecting a
 * pure numeric paste. Per-field requiredness is each screen's own
 * concern; this only checks format when the value is non-empty.
 */
export function isValidPlaceText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /\p{L}/u.test(trimmed);
}

/** Shape check for Pincode: exactly 6 digits. */
export function isValidPincodeFormat(value: string): boolean {
  return /^\d{6}$/.test(value);
}

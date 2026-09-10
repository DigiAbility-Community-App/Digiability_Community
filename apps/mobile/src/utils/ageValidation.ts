// ─────────────────────────────────────────────────────────────
// Age eligibility — client side
//
// Mirrors services/user-svc/src/utils/age.util.ts. The SERVER is the gate:
// this exists so someone gets a clear message before submitting, not to decide
// eligibility. A request that bypasses the app is rejected by the same rule.
//
// Keep in step with docs/legal/06-age-policy-and-gate-spec.md.
// ─────────────────────────────────────────────────────────────

export const MINIMUM_AGE = 18;

/** Whole years elapsed since `dob`. */
export function calculateAge(dob: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

export function isOldEnough(dob: Date, now: Date = new Date()): boolean {
  return calculateAge(dob, now) >= MINIMUM_AGE;
}

/** The date exactly MINIMUM_AGE years ago — the latest eligible birth date. */
export function latestEligibleBirthDate(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - MINIMUM_AGE);
  return d;
}

/** Format a Date as the YYYY-MM-DD the API expects. */
export function toApiDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Format a Date as DD/MM/YYYY for display, matching the profile screens. */
export function toDisplayDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

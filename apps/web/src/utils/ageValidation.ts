// ─────────────────────────────────────────────────────────────
// Age eligibility — client side
//
// Mirrors services/user-svc/src/utils/age.util.ts. The SERVER is the gate;
// this exists to give a clear message before submitting.
//
// Keep in step with docs/legal/06-age-policy-and-gate-spec.md.
// ─────────────────────────────────────────────────────────────

export const MINIMUM_AGE = 18;

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

/** The latest birth date that still meets the minimum age, as YYYY-MM-DD. */
export function maxEligibleBirthDateISO(now: Date = new Date()): string {
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - MINIMUM_AGE);
  return d.toISOString().slice(0, 10);
}

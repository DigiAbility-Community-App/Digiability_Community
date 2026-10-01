// ─────────────────────────────────────────────────────
// Age eligibility — DPDP Act 2023 §9
//
// Digiability is an 18+ platform. §9 requires verifiable parental consent
// before processing a child's personal data, so rather than build that we do
// not accept under-18 account holders at all.
//
// The rule lives here so registration and the backfill prompt cannot drift
// apart. The published specification is docs/legal/06-age-policy-and-gate-spec.md
// — keep the two in step.
//
// This is an age GATE, not age verification: the date of birth is self-declared.
// Doc 06 §1.6 states that limitation plainly rather than implying otherwise.
// ─────────────────────────────────────────────────────

export const MINIMUM_AGE = 18;

// Above this we treat the input as a typo rather than a very old user. The
// oldest verified human lived to 122.
const MAX_PLAUSIBLE_AGE = 120;

// Ages are evaluated against the calendar date in India, not the server's
// timezone. A UTC server would otherwise turn someone away for several hours
// on the day of their 18th birthday.
const REFERENCE_TIMEZONE = "Asia/Kolkata";

/** Today's calendar date in the reference timezone, as {y, m, d}. */
function todayInReferenceZone(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REFERENCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/**
 * Whole years elapsed since `dob`, evaluated against the current date in India.
 * Exported for the backfill path and for tests.
 */
export function calculateAge(dob: Date, now: Date = new Date()): number {
  const today = todayInReferenceZone(now);

  // The stored value is a calendar date; read it in UTC so a timezone offset
  // can't shift it onto the previous or next day.
  const birthY = dob.getUTCFullYear();
  const birthM = dob.getUTCMonth() + 1;
  const birthD = dob.getUTCDate();

  let age = today.y - birthY;
  if (today.m < birthM || (today.m === birthM && today.d < birthD)) {
    age -= 1;
  }
  return age;
}

export type AgeCheck =
  | { eligible: true; age: number }
  | { eligible: false; age: number | null; reason: string };

/**
 * Decide whether a declared date of birth may hold an account.
 *
 * Returns a reason rather than throwing so callers can choose between a
 * validation error (registration) and routing to review (backfill).
 */
export function checkAgeEligibility(dob: Date, now: Date = new Date()): AgeCheck {
  if (Number.isNaN(dob.getTime())) {
    return { eligible: false, age: null, reason: "Please enter a valid date of birth." };
  }

  const age = calculateAge(dob, now);

  if (age < 0) {
    return {
      eligible: false,
      age,
      reason: "That date of birth is in the future. Please check and try again.",
    };
  }

  if (age > MAX_PLAUSIBLE_AGE) {
    return {
      eligible: false,
      age,
      reason: "Please enter a valid date of birth.",
    };
  }

  if (age < MINIMUM_AGE) {
    return {
      eligible: false,
      age,
      reason: `You must be ${MINIMUM_AGE} or older to use Digiability Community.`,
    };
  }

  return { eligible: true, age };
}

/** Convenience for the common yes/no case. */
export function isEligibleAge(dob: Date, now: Date = new Date()): boolean {
  return checkAgeEligibility(dob, now).eligible;
}

// ─────────────────────────────────────────────────────────────
// Password policy rules, shared by the signup and reset-password forms.
//
// The rules themselves are configured by an admin (Settings → Password
// Policy) and served by user-svc at /api/master/password-policy, so this file
// deliberately holds no hardcoded numbers beyond the offline fallback — the
// screen shows exactly what the API will enforce instead of a second copy
// that drifts the moment someone changes the policy.
// ─────────────────────────────────────────────────────────────

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/**
 * Used only until the live policy loads, or if the request fails (offline,
 * server down). Mirrors DEFAULT_PASSWORD_POLICY in
 * services/user-svc/src/services/passwordPolicy.service.ts.
 */
export const FALLBACK_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 16,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

/** Must stay identical to SPECIAL_CHAR_REGEX on the server. */
const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

export interface PasswordRule {
  /** Stable key for React list rendering. */
  key: string;
  label: string;
  met: boolean;
}

/**
 * Builds the checklist shown under the password field. Every rule is always
 * returned (not just the failing ones) so the user can see the full criteria
 * before typing, with each item ticking off live as it's satisfied.
 */
export function evaluatePassword(password: string, policy: PasswordPolicy): PasswordRule[] {
  const rules: PasswordRule[] = [
    {
      key: "length",
      label: `${policy.minLength}–${policy.maxLength} characters`,
      met: password.length >= policy.minLength && password.length <= policy.maxLength,
    },
  ];

  if (policy.requireLowercase) {
    rules.push({ key: "lower", label: "One lowercase letter (a–z)", met: /[a-z]/.test(password) });
  }
  if (policy.requireUppercase) {
    rules.push({ key: "upper", label: "One uppercase letter (A–Z)", met: /[A-Z]/.test(password) });
  }
  if (policy.requireNumber) {
    rules.push({ key: "number", label: "One number (0–9)", met: /\d/.test(password) });
  }
  if (policy.requireSpecial) {
    rules.push({
      key: "special",
      label: "One special character (! @ # $ …)",
      met: SPECIAL_CHAR_REGEX.test(password),
    });
  }

  return rules;
}

/** True when every rule in the policy is satisfied. */
export function isPasswordValid(password: string, policy: PasswordPolicy): boolean {
  return evaluatePassword(password, policy).every((r) => r.met);
}

/**
 * First unmet rule, phrased as a sentence — used for the form-level error
 * message so the wording matches the checklist the user is looking at.
 */
export function firstPasswordError(password: string, policy: PasswordPolicy): string | null {
  const failed = evaluatePassword(password, policy).find((r) => !r.met);
  if (!failed) return null;
  if (failed.key === "length") {
    return `Password must be ${policy.minLength}–${policy.maxLength} characters.`;
  }
  return `Password must include: ${failed.label.toLowerCase()}.`;
}

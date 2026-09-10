import prisma from "../models/prisma.client";

// ─────────────────────────────────────────────────────────────
// Password policy — single source of truth.
//
// The admin panel has always had a Password Policy screen writing to
// `admin_security_settings`, but nothing ever read it: RegisterSchema and
// ResetPasswordSchema hardcoded "min 8, max 16, upper+lower+digit", so an
// admin could set a 12-character minimum and require a special character and
// signup would keep accepting 8-character passwords with neither.
//
// This module reads that table so the configured policy is what's actually
// enforced, and exposes it over /api/master/password-policy so the mobile and
// web clients can show the same rules they'll be judged against instead of
// hardcoding a second, drifting copy.
//
// The table is owned by the admin panel (it creates it on first open), so a
// missing table is normal on a fresh database — fall back to the same defaults
// the admin panel itself declares.
// ─────────────────────────────────────────────────────────────

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  /**
   * No admin toggle exists for lowercase — it has always been required and
   * stays required, so tightening the other rules can't accidentally make a
   * password weaker than what the platform accepted before.
   */
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

/** Mirrors the column defaults in the admin panel's admin_security_settings. */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 16,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

/** Anything that isn't a letter or a digit. Kept identical on both clients. */
export const SPECIAL_CHAR_REGEX = /[^A-Za-z0-9]/;

// The policy changes only when an admin saves the Settings screen, but it is
// read on every registration, every reset and every client that opens a signup
// form — so cache it briefly rather than hitting Postgres each time.
const CACHE_TTL_MS = 60_000;
let cached: { value: PasswordPolicy; expiresAt: number } | null = null;

/** Clears the cache — used by tests and after an admin policy update. */
export function invalidatePasswordPolicyCache(): void {
  cached = null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
}

export async function getPasswordPolicy(): Promise<PasswordPolicy> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let policy = DEFAULT_PASSWORD_POLICY;

  try {
    const rows = await prisma.$queryRaw<
      {
        min_password_len: number | null;
        max_password_len: number | null;
        require_uppercase: boolean | null;
        require_numbers: boolean | null;
        require_special: boolean | null;
      }[]
    >`
      SELECT min_password_len, max_password_len, require_uppercase, require_numbers, require_special
      FROM admin_security_settings
      WHERE id = 'default'
      LIMIT 1
    `;

    const row = rows[0];
    if (row) {
      // Bounds mirror the admin panel's own clamps, so a value written
      // directly to the table can't produce an unsatisfiable policy.
      const minLength = clampInt(row.min_password_len, DEFAULT_PASSWORD_POLICY.minLength, 8, 16);
      policy = {
        minLength,
        maxLength: clampInt(row.max_password_len, DEFAULT_PASSWORD_POLICY.maxLength, minLength, 16),
        requireUppercase: row.require_uppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
        requireLowercase: true,
        requireNumber: row.require_numbers ?? DEFAULT_PASSWORD_POLICY.requireNumber,
        requireSpecial: row.require_special ?? DEFAULT_PASSWORD_POLICY.requireSpecial,
      };
    }
  } catch {
    // Table absent (admin panel never opened) — defaults already assigned.
  }

  cached = { value: policy, expiresAt: Date.now() + CACHE_TTL_MS };
  return policy;
}

/**
 * Human-readable rules, in the order clients should display them. Returned by
 * the API so mobile and web render exactly what the server enforces rather
 * than each maintaining its own wording.
 */
export function describePasswordPolicy(policy: PasswordPolicy): string[] {
  const rules = [`Between ${policy.minLength} and ${policy.maxLength} characters`];
  if (policy.requireLowercase) rules.push("At least one lowercase letter (a-z)");
  if (policy.requireUppercase) rules.push("At least one uppercase letter (A-Z)");
  if (policy.requireNumber) rules.push("At least one number (0-9)");
  if (policy.requireSpecial) rules.push("At least one special character (e.g. ! @ # $)");
  return rules;
}

/**
 * Returns one {field, message} per unmet rule — the same shape the Zod
 * validate middleware produces, so a policy failure and a schema failure look
 * identical to a client.
 */
export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy
): { field: string; message: string }[] {
  const errors: { field: string; message: string }[] = [];
  const push = (message: string) => errors.push({ field: "password", message });

  if (password.length < policy.minLength) {
    push(`Password must be at least ${policy.minLength} characters`);
  }
  if (password.length > policy.maxLength) {
    push(`Password must be at most ${policy.maxLength} characters`);
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    push("Password must include at least one lowercase letter");
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    push("Password must include at least one uppercase letter");
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    push("Password must include at least one number");
  }
  if (policy.requireSpecial && !SPECIAL_CHAR_REGEX.test(password)) {
    push("Password must include at least one special character");
  }

  return errors;
}

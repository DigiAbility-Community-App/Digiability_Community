import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────
// Password Hashing (bcrypt)
// ─────────────────────────────────────────────────────

/**
 * Hash a plain-text password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plain-text password against a bcrypt hash.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────────────
// Token Generation + Hashing (SHA-256)
// ─────────────────────────────────────────────────────

/**
 * Generate a cryptographically secure random token (URL-safe hex string).
 * Returns both the raw token (to send to user) and its SHA-256 hash (to store in DB).
 */
export function generateToken(byteLength = 32): {
  rawToken: string;
  tokenHash: string;
} {
  const rawToken = crypto.randomBytes(byteLength).toString("hex");
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * SHA-256 hash a token string.
 * Used to safely store tokens in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

import prisma from "../models/prisma.client";
import { generateToken, hashToken } from "../utils/hash.util";
import { signAccessToken } from "../utils/jwt.util";

// ─────────────────────────────────────────────────────
// Token Service
// Manages refresh tokens, email verification tokens,
// and password reset tokens.
// ─────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30",
  10
);
const EMAIL_VERIFICATION_EXPIRES_HOURS = 24;
const PASSWORD_RESET_EXPIRES_HOURS = 1;

// ─── Refresh Tokens ────────────────────────────────────

/**
 * Create a new refresh token for a user.
 * Returns the raw token (sent to client via cookie).
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const { rawToken, tokenHash } = generateToken(64);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      revoked: false,
    },
  });

  return rawToken;
}

/**
 * Validate a raw refresh token.
 * Returns the DB record if valid, throws if invalid/expired/revoked.
 */
export async function validateRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!stored) throw new Error("Invalid refresh token");
  if (stored.revoked) throw new Error("Refresh token has been revoked");
  if (stored.expiresAt < new Date()) throw new Error("Refresh token expired");

  return stored;
}

/**
 * Rotate a refresh token (delete old, create new).
 * Returns new raw refresh token + new access token.
 */
export async function rotateRefreshToken(
  rawOldToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await validateRefreshToken(rawOldToken);

  // Delete the old token (prevent reuse)
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  // Issue new tokens
  const newRefreshToken = await createRefreshToken(stored.userId);
  const accessToken = signAccessToken({
    sub: stored.user.id,
    email: stored.user.email,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Revoke a specific refresh token (logout).
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });
}

/**
 * Revoke ALL refresh tokens for a user (logout all devices).
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

// ─── Email Verification Tokens ─────────────────────────

/**
 * Create an email verification token for a user.
 * Returns the raw token (to be sent via email link).
 */
export async function createEmailVerificationToken(
  userId: string
): Promise<string> {
  const { rawToken, tokenHash } = generateToken(32);

  const expiresAt = new Date();
  expiresAt.setHours(
    expiresAt.getHours() + EMAIL_VERIFICATION_EXPIRES_HOURS
  );

  // Delete any existing tokens for this user first
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  await prisma.emailVerificationToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });

  return rawToken;
}

/**
 * Validate an email verification token.
 * Returns the associated userId if valid.
 */
export async function validateEmailVerificationToken(
  rawToken: string
): Promise<string> {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.emailVerificationToken.findFirst({
    where: { token: tokenHash },
  });

  if (!stored) throw new Error("Invalid or expired verification link");
  if (stored.expiresAt < new Date())
    throw new Error("Verification link has expired");

  return stored.userId;
}

/**
 * Delete a used email verification token.
 */
export async function deleteEmailVerificationToken(
  rawToken: string
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.emailVerificationToken.deleteMany({
    where: { token: tokenHash },
  });
}

// ─── Password Reset Tokens ─────────────────────────────

/**
 * Create a password reset token for a user.
 * Returns the raw token (to send via email).
 */
export async function createPasswordResetToken(
  userId: string
): Promise<string> {
  const { rawToken, tokenHash } = generateToken(32);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRES_HOURS);

  // Delete any existing reset tokens first
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });

  return rawToken;
}

/**
 * Validate a password reset token.
 * Returns the associated userId if valid.
 */
export async function validatePasswordResetToken(
  rawToken: string
): Promise<string> {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.passwordResetToken.findFirst({
    where: { token: tokenHash },
  });

  if (!stored) throw new Error("Invalid or expired reset link");
  if (stored.expiresAt < new Date())
    throw new Error("Password reset link has expired");

  return stored.userId;
}

/**
 * Delete a used password reset token.
 */
export async function deletePasswordResetToken(
  rawToken: string
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.passwordResetToken.deleteMany({
    where: { token: tokenHash },
  });
}

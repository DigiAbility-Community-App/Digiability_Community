import crypto from "crypto";
import prisma from "../models/prisma.client";
import { generateToken, hashToken } from "../utils/hash.util";
import { signAccessToken, decodeToken } from "../utils/jwt.util";
import { revokeJti } from "../config/redis";
import { auditLog } from "./audit.service";

// ─────────────────────────────────────────────────────
// Token Service
// Manages refresh tokens, email verification OTPs,
// and password reset tokens.
//
// Refresh token security model:
//   • Every token is hashed (SHA-256) before storage.
//   • Tokens belong to a "family" (familyId UUID). A family
//     is the chain of all tokens issued from one login event.
//   • On rotation: old token is MARKED REVOKED (not deleted),
//     new token inherits the same familyId.
//   • If a revoked token is presented, we detect session theft:
//     revoke the ENTIRE family so the attacker's newer token
//     also becomes invalid.
// ─────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30",
  10
);
const PASSWORD_RESET_EXPIRES_HOURS = 1;

// ─── Refresh Tokens ────────────────────────────────────

/**
 * Create a new refresh token, optionally within an existing family.
 * Returns the raw token (sent to the client via cookie/header).
 */
export async function createRefreshToken(
  userId: string,
  familyId: string = crypto.randomUUID()
): Promise<string> {
  const { rawToken, tokenHash } = generateToken(64);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, familyId, expiresAt, revoked: false },
  });

  return rawToken;
}

/**
 * Validate a raw refresh token.
 *
 * Reuse detection: if the token hash is found but revoked=true, it means
 * a previously-rotated token is being replayed. This is a theft signal —
 * revoke every token in the same family to invalidate any stolen session.
 */
export async function validateRefreshToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true } } },
  });

  if (!stored) throw new Error("Invalid refresh token");

  if (stored.revoked) {
    // Reuse of a rotated token: revoke the entire family to invalidate
    // any token the attacker may have obtained through the rotation chain.
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId },
      data: { revoked: true },
    });
    auditLog("auth.token_reuse", {
      userId: stored.userId,
      detail: { familyId: stored.familyId },
    });
    throw new Error("Refresh token reuse detected. All sessions have been revoked.");
  }

  if (stored.expiresAt < new Date()) throw new Error("Refresh token expired");

  return stored;
}

/**
 * Rotate a refresh token: mark old as revoked, issue new in the same family.
 * Returns new raw refresh token + new access token.
 */
export async function rotateRefreshToken(
  rawOldToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await validateRefreshToken(rawOldToken);

  // Mark old token revoked (keep it so reuse can be detected)
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revoked: true },
  });

  // Issue new token in the same family
  const newRefreshToken = await createRefreshToken(stored.userId, stored.familyId);
  const accessToken = signAccessToken({ sub: stored.user.id, email: stored.user.email });

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Revoke a specific refresh token (logout single device).
 * Also adds the accompanying access token JTI to the Redis blocklist.
 */
export async function revokeRefreshToken(
  rawToken: string,
  accessToken?: string
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true },
  });

  // Immediately invalidate the current access token before it expires
  if (accessToken) {
    await addAccessTokenToBlocklist(accessToken);
  }
}

/**
 * Revoke ALL refresh tokens for a user (logout all devices, password reset, account deletion).
 */
export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}

/**
 * Add a raw access token's JTI to the Redis revocation blocklist.
 * TTL is set to the token's remaining lifetime so the key self-cleans.
 */
export async function addAccessTokenToBlocklist(rawAccessToken: string): Promise<void> {
  try {
    const payload = decodeToken(rawAccessToken);
    if (!payload?.jti) return;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttl = payload.exp ? payload.exp - nowSeconds : 0;

    await revokeJti(payload.jti, ttl);
  } catch {
    // Non-fatal: if Redis is unavailable, token expires naturally in ≤15m
  }
}

// ─── Email Verification OTPs ───────────────────────────

const EMAIL_OTP_EXPIRES_MINUTES = 10;
const EMAIL_OTP_MAX_ATTEMPTS = 5;

function generateOtp(): { rawOtp: string; otpHash: string } {
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const otpHash = hashToken(rawOtp);
  return { rawOtp, otpHash };
}

export async function createEmailVerificationOtp(userId: string): Promise<string> {
  const { rawOtp, otpHash } = generateOtp();

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + EMAIL_OTP_EXPIRES_MINUTES);

  await prisma.emailVerificationToken.deleteMany({ where: { userId } });

  await prisma.emailVerificationToken.create({
    data: { userId, token: otpHash, expiresAt },
  });

  return rawOtp;
}

export async function validateEmailVerificationOtp(
  userId: string,
  rawOtp: string
): Promise<string> {
  const stored = await prisma.emailVerificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!stored) throw new Error("No verification OTP found. Please request a new one.");
  if (stored.expiresAt < new Date()) throw new Error("OTP has expired. Please request a new one.");

  if (stored.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await prisma.emailVerificationToken.delete({ where: { id: stored.id } });
    throw new Error("Too many incorrect attempts. Please request a new verification code.");
  }

  const otpHash = hashToken(rawOtp);

  if (otpHash !== stored.token) {
    await prisma.emailVerificationToken.update({
      where: { id: stored.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = EMAIL_OTP_MAX_ATTEMPTS - stored.attempts - 1;
    throw new Error(`Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`);
  }

  return stored.userId;
}

export async function deleteEmailVerificationOtp(userId: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
}

// ─── Password Reset Tokens ─────────────────────────────

export async function createPasswordResetToken(userId: string): Promise<string> {
  const { rawToken, tokenHash } = generateToken(32);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + PASSWORD_RESET_EXPIRES_HOURS);

  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: { userId, token: tokenHash, expiresAt },
  });

  return rawToken;
}

export async function validatePasswordResetToken(rawToken: string): Promise<string> {
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.passwordResetToken.findFirst({
    where: { token: tokenHash },
  });

  if (!stored) throw new Error("Invalid or expired reset link");
  if (stored.expiresAt < new Date()) throw new Error("Password reset link has expired");

  return stored.userId;
}

export async function deletePasswordResetToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.passwordResetToken.deleteMany({ where: { token: tokenHash } });
}

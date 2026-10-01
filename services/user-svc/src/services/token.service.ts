import crypto from "crypto";
import prisma from "../models/prisma.client";
import { generateToken, hashToken } from "../utils/hash.util";
import { signAccessToken } from "../utils/jwt.util";
import { publishSessionRevoked } from "../config/redis";
import { markSessionRevoked } from "./session.service";
import { auditLog } from "./audit.service";
import { createError } from "../middleware/error.middleware";
import { assertNotSuspended } from "../utils/suspension.util";

// ─────────────────────────────────────────────────────
// Token Service
// Manages login sessions, refresh tokens, email verification OTPs,
// and password reset OTPs.
//
// Session model (VAPT M-003 / CWE-613):
//   • Each login creates a row in `sessions`. Its id is the `sid` claim in
//     every access token minted for that login, and every service rejects a
//     token whose session is revoked — so logout is immediate, not "when the
//     access token expires".
//   • Refresh tokens are hashed (SHA-256) and rotated on every use. The old
//     token is marked revoked (kept, not deleted) and the session points at
//     the new one.
//   • Presenting an already-rotated refresh token is a theft signal: the
//     whole session is revoked, killing the attacker's copy and the victim's.
// ─────────────────────────────────────────────────────

const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(
  process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? "30",
  10
);
const PASSWORD_RESET_OTP_EXPIRES_MINUTES = 10;
const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;

export type SessionRevokeReason =
  | "logout"
  | "logout_all"
  | "password_reset"
  | "reuse_detected"
  | "account_deleted";

function refreshExpiry(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
  return expiresAt;
}

// ─── Sessions ──────────────────────────────────────────

/**
 * Start a session for a freshly authenticated user. Returns the raw refresh
 * token (sent to the client via cookie/header) and an access token bound to
 * the new session.
 */
export async function createSession(
  user: { id: string; email: string },
  userAgent?: string
): Promise<{ sessionId: string; accessToken: string; refreshToken: string }> {
  const { rawToken, tokenHash } = generateToken(64);
  const expiresAt = refreshExpiry();
  const sessionId = crypto.randomUUID();

  await prisma.$transaction([
    prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: tokenHash,
        userAgent: userAgent ? userAgent.slice(0, 255) : null,
        expiresAt,
      },
    }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, familyId: sessionId, sessionId, expiresAt },
    }),
  ]);

  const accessToken = signAccessToken({ sub: user.id, email: user.email, sid: sessionId });
  return { sessionId, accessToken, refreshToken: rawToken };
}

/** Tell every service the session is dead, and drop its live sockets. */
async function broadcastRevocation(sid: string, userId: string): Promise<void> {
  await markSessionRevoked(sid);
  await publishSessionRevoked(sid, userId).catch(() => {
    // Non-fatal: REST checks still see the revocation via the cache/DB.
  });
}

/** Broadcast that sessions already removed from the DB (account deletion) are dead. */
export async function broadcastSessionsEnded(userId: string, sids: string[]): Promise<void> {
  await Promise.all(sids.map((sid) => broadcastRevocation(sid, userId)));
}

/**
 * Revoke one session: its access tokens stop working on their next request
 * and its refresh tokens can no longer be used. Idempotent.
 */
export async function revokeSession(sid: string, reason: SessionRevokeReason): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sid },
    select: { userId: true },
  });
  if (!session) return false;

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { id: sid, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
    prisma.refreshToken.updateMany({
      where: { sessionId: sid },
      data: { revoked: true },
    }),
  ]);

  await broadcastRevocation(sid, session.userId);
  auditLog("auth.session_revoked", { userId: session.userId, detail: { sid, reason } });
  return true;
}

/**
 * Revoke every session a user has (logout all devices, password reset).
 * Returns how many live sessions were ended.
 */
export async function revokeAllUserSessions(
  userId: string,
  reason: SessionRevokeReason
): Promise<number> {
  const live = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    }),
    // All of the user's refresh tokens, including any that predate sessions.
    prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    }),
  ]);

  await Promise.all(live.map((s) => broadcastRevocation(s.id, userId)));
  auditLog("auth.sessions_revoked_all", { userId, detail: { reason, count: live.length } });
  return live.length;
}

/**
 * Logout by refresh token, for clients whose access token is gone or expired.
 * Returns false when the token is unknown.
 */
export async function revokeSessionByRefreshToken(
  rawToken: string,
  reason: SessionRevokeReason
): Promise<boolean> {
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(rawToken) },
    select: { sessionId: true, familyId: true },
  });
  if (!stored) return false;

  if (stored.sessionId) return revokeSession(stored.sessionId, reason);

  // Token from before sessions existed: end its family instead.
  await prisma.refreshToken.updateMany({
    where: { familyId: stored.familyId },
    data: { revoked: true },
  });
  return true;
}

// ─── Refresh Tokens ────────────────────────────────────

class RefreshReuseError extends Error {}

/**
 * Validate a raw refresh token and its session. A revoked token on a live
 * session means a rotated token is being replayed — the session is revoked
 * before rejecting.
 */
async function validateRefreshToken(rawToken: string) {
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(rawToken) },
    include: {
      session: { select: { id: true, revokedAt: true } },
      user: {
        select: {
          id: true,
          email: true,
          deletedAt: true,
          isEmailVerified: true,
          isSuspended: true,
          suspendedUntil: true,
          suspensionReason: true,
        },
      },
    },
  });

  if (!stored) throw createError("Invalid refresh token", 401);

  if (stored.session?.revokedAt) {
    throw createError("Your session has ended. Please log in again.", 401);
  }

  if (stored.revoked) {
    await handleReuse(stored.userId, stored.sessionId, stored.familyId);
    throw createError("Refresh token reuse detected. This session has been revoked.", 401);
  }

  if (stored.expiresAt < new Date()) throw createError("Refresh token expired", 401);
  if (!stored.user || stored.user.deletedAt !== null) {
    throw createError("Account not found or has been deleted.", 401);
  }

  // A ban must survive an existing session: block token refresh too, so a
  // suspended user is fully logged out within one access-token lifetime.
  assertNotSuspended(stored.user);

  // Defence in depth. Sessions are only issued after email verification now,
  // but any token that predates that change (or escapes by some other route)
  // dies here at its first rotation instead of refreshing indefinitely.
  if (!stored.user.isEmailVerified) {
    throw createError("Please verify your email address before continuing.", 403);
  }

  return stored;
}

async function handleReuse(userId: string, sessionId: string | null, familyId: string) {
  if (sessionId) {
    await revokeSession(sessionId, "reuse_detected");
  } else {
    await prisma.refreshToken.updateMany({ where: { familyId }, data: { revoked: true } });
  }
  auditLog("auth.token_reuse", { userId, detail: { sessionId, familyId } });
}

/**
 * Rotate a refresh token: the presented token is consumed, a new one is
 * issued on the same session, and a fresh access token is signed for it.
 */
export async function rotateRefreshToken(
  rawOldToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await validateRefreshToken(rawOldToken);
  const { rawToken, tokenHash } = generateToken(64);
  const expiresAt = refreshExpiry();
  // Tokens from before sessions existed get one now, keyed by their family,
  // so users who were logged in across the migration are not logged out.
  const sessionId = stored.sessionId ?? stored.familyId;

  try {
    await prisma.$transaction(async (tx) => {
      // Conditional consume: if two requests race with the same token, only
      // one wins; the loser is treated as reuse.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revoked: false },
        data: { revoked: true },
      });
      if (count === 0) throw new RefreshReuseError();

      await tx.session.upsert({
        where: { id: sessionId },
        update: { refreshTokenHash: tokenHash, lastUsedAt: new Date(), expiresAt },
        create: { id: sessionId, userId: stored.userId, refreshTokenHash: tokenHash, expiresAt },
      });

      await tx.refreshToken.create({
        data: { userId: stored.userId, tokenHash, familyId: stored.familyId, sessionId, expiresAt },
      });
      if (!stored.sessionId) {
        await tx.refreshToken.updateMany({
          where: { familyId: stored.familyId, sessionId: null },
          data: { sessionId },
        });
      }
    });
  } catch (err) {
    if (err instanceof RefreshReuseError) {
      await handleReuse(stored.userId, sessionId, stored.familyId);
      throw createError("Refresh token reuse detected. This session has been revoked.", 401);
    }
    throw err;
  }

  const accessToken = signAccessToken({ sub: stored.user.id, email: stored.user.email, sid: sessionId });
  return { accessToken, refreshToken: rawToken };
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

  // createError, not `new Error`: a bare Error has no statusCode and no
  // isOperational flag, so errorHandler returns 500 with the generic
  // "An unexpected error occurred" and the user never sees the instruction
  // below. That is what made a locked-out OTP look like "the code never came".
  if (!stored) throw createError("No verification OTP found. Please request a new one.", 400);
  if (stored.expiresAt < new Date())
    throw createError("OTP has expired. Please request a new one.", 400);

  if (stored.attempts >= EMAIL_OTP_MAX_ATTEMPTS) {
    await prisma.emailVerificationToken.delete({ where: { id: stored.id } });
    throw createError("Too many incorrect attempts. Please request a new verification code.", 429);
  }

  const otpHash = hashToken(rawOtp);

  if (otpHash !== stored.token) {
    await prisma.emailVerificationToken.update({
      where: { id: stored.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = EMAIL_OTP_MAX_ATTEMPTS - stored.attempts - 1;
    throw createError(`Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400);
  }

  return stored.userId;
}

export async function deleteEmailVerificationOtp(userId: string): Promise<void> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
}

// ─── Password Reset OTPs ───────────────────────────────
// Password reset uses a 6-digit OTP (same UX as email verification),
// not a long link-token — the mobile app has no way to receive a
// web-style reset link. Looked up by userId (not the bare code) so we
// can enforce a per-user failed-attempt lockout against brute force.

export async function createPasswordResetOtp(userId: string): Promise<string> {
  const rawOtp = crypto.randomInt(100000, 999999).toString();
  const otpHash = hashToken(rawOtp);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + PASSWORD_RESET_OTP_EXPIRES_MINUTES);

  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  await prisma.passwordResetToken.create({
    data: { userId, token: otpHash, expiresAt },
  });

  return rawOtp;
}

/**
 * Validate a password-reset OTP for a given user. Returns the userId on
 * success; increments the attempt counter and throws on mismatch, deleting
 * the OTP once the attempt ceiling is hit.
 */
export async function validatePasswordResetOtp(
  userId: string,
  rawOtp: string
): Promise<string> {
  const stored = await prisma.passwordResetToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!stored) throw createError("No password reset code found. Please request a new one.", 400);
  if (stored.expiresAt < new Date()) {
    throw createError("Password reset code has expired. Please request a new one.", 400);
  }

  if (stored.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS) {
    await prisma.passwordResetToken.delete({ where: { id: stored.id } });
    throw createError("Too many incorrect attempts. Please request a new reset code.", 400);
  }

  const otpHash = hashToken(rawOtp);

  if (otpHash !== stored.token) {
    await prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = PASSWORD_RESET_OTP_MAX_ATTEMPTS - stored.attempts - 1;
    throw createError(`Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`, 400);
  }

  return stored.userId;
}

export async function deletePasswordResetOtp(userId: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}

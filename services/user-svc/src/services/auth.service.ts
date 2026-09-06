import prisma from "../models/prisma.client";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { signAccessToken } from "../utils/jwt.util";
import { createError } from "../middleware/error.middleware";
import { assertNotSuspended, isCurrentlySuspended } from "../utils/suspension.util";
import {
  createEmailVerificationOtp,
  validateEmailVerificationOtp,
  deleteEmailVerificationOtp,
  createRefreshToken,
  createPasswordResetOtp,
  validatePasswordResetOtp,
  deletePasswordResetOtp,
  revokeAllUserRefreshTokens,
} from "./token.service";
import {
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
} from "./email.service";
import { auditLog } from "./audit.service";
import { recordRegistrationConsents } from "./consent.service";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateRoleInput,
} from "../utils/validation.util";
import { Role } from "../generated/client";

// ─────────────────────────────────────────────────────
// Auth Service — Core business logic
// ─────────────────────────────────────────────────────

// ─── Email Verification (OTP) ──────────────────────────

export async function verifyEmailOtp(
  email: string,
  otp: string
): Promise<LoginResult & { message: string }> {
  // 1. Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw createError("Invalid email or OTP", 400);

  // 2. Validate OTP
  await validateEmailVerificationOtp(user.id, otp);

  // 3. Mark user as verified
  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, lastSeen: new Date() },
  });

  // 4. Delete used OTP
  await deleteEmailVerificationOtp(user.id);

  auditLog("auth.email_verified", { userId: user.id, email });

  // 5. Issue the session here rather than at registration. Registration used
  // to hand out an access token and a 30-day refresh token before the email
  // was ever confirmed, and nothing downstream re-checked isEmailVerified —
  // not the authenticate middleware, not refresh rotation, and not chat-svc
  // or forum-svc, which only verify the JWT signature. Minting only after
  // verification means no valid token can exist for an unverified account,
  // so every downstream service is protected without changing any of them.
  const accessToken = signAccessToken({ sub: verifiedUser.id, email: verifiedUser.email });
  const refreshToken = await createRefreshToken(verifiedUser.id);

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(verifiedUser),
    message: "Email verified successfully.",
  };
}

// ─── Resend Verification OTP ───────────────────────────

export async function resendVerificationOtp(
  email: string
): Promise<{ message: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Don't reveal whether email exists
    return { message: "If an account with that email exists, a new OTP has been sent." };
  }

  if (user.isEmailVerified) {
    return { message: "Email is already verified." };
  }

  // Rate limit: check if an OTP was created in the last 60 seconds
  const recentOtp = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (recentOtp) {
    const secondsSinceCreation = (Date.now() - recentOtp.createdAt.getTime()) / 1000;
    if (secondsSinceCreation < 60) {
      throw createError(
        `Please wait ${Math.ceil(60 - secondsSinceCreation)} seconds before requesting a new OTP.`,
        429
      );
    }
  }

  const rawOtp = await createEmailVerificationOtp(user.id);

  // Awaited (not fire-and-forget) so a send failure is visible to the
  // caller instead of the API responding "sent" before the send even
  // resolves. Safe to report honestly here — we've already confirmed this
  // account exists and created the OTP row, so an honest failure doesn't
  // leak account existence the way the "no such account" branch above must
  // stay vague about.
  try {
    await sendVerificationOtpEmail(user.email, user.name, rawOtp);
  } catch (err) {
    console.error("[EmailService] Failed to send verification OTP (resend):", err);
    throw createError(
      "We couldn't send the verification email right now. Please try again in a moment.",
      502
    );
  }

  return { message: "If an account with that email exists, a new OTP has been sent." };
}

// ─── Login ─────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    roles: string[];
    profileComplete: boolean;
    isEmailVerified: boolean;
  };
  /** Only meaningful on the registration path — whether the verification
   *  OTP email actually sent. `undefined` for login, where no OTP is sent. */
  otpEmailSent?: boolean;
}

/**
 * Registration deliberately carries NO tokens — an unverified account gets no
 * session. The client sends the user to the OTP screen; verifyEmailOtp is what
 * returns a LoginResult.
 */
export interface RegisterResult {
  user: LoginResult["user"];
  otpEmailSent: boolean;
}

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  profileComplete: boolean;
  isEmailVerified: boolean;
  phoneNo?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roles[0] || null,
    roles: user.roles,
    profileComplete: user.profileComplete,
    isEmailVerified: user.isEmailVerified,
    phoneNo: user.phoneNo ?? null,
  };
}

export async function registerUser(
  input: RegisterInput,
  ip?: string
): Promise<RegisterResult> {
  const { name, email, password, role, roles, phoneNo } = input as any;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw createError("An account with this email already exists", 400);
  }

  const hashedPassword = await hashPassword(password);

  let dbRoles: Role[] = [];
  if (roles && Array.isArray(roles)) {
    dbRoles = roles.filter(r => r && r !== "other").map(r => r as Role);
  } else if (role && role !== "other") {
    dbRoles = [role as Role];
  }

  const userData: any = { name, email, password: hashedPassword, roles: dbRoles, isEmailVerified: false };
  if (phoneNo && typeof phoneNo === 'string' && phoneNo.trim()) {
    userData.phoneNo = phoneNo.trim();
  }

  const user = await prisma.user.create({ data: userData });

  // Record mandatory DATA_PROCESSING consent at registration (DPDP §6)
  recordRegistrationConsents(user.id, ip).catch((err) =>
    console.error("[ConsentService] Failed to record registration consent:", err)
  );

  auditLog("auth.register", { userId: user.id, email: user.email });

  // Email verification is enabled. Awaited (not fire-and-forget) so we know
  // whether it actually sent — registration still succeeds either way (a
  // failed confirmation email shouldn't undo a successful signup), but the
  // controller uses otpEmailSent to tell the client honestly rather than
  // claiming "OTP sent" when it wasn't.
  const rawOtp = await createEmailVerificationOtp(user.id);
  let otpEmailSent = true;
  try {
    await sendVerificationOtpEmail(user.email, user.name, rawOtp);
  } catch (err) {
    console.error("[EmailService] Failed to send verification OTP (register):", err);
    otpEmailSent = false;
  }

  // Deliberately NO tokens here — see verifyEmailOtp. An account that hasn't
  // confirmed its email gets no session at all, so it cannot reach the API.
  return {
    user: toAuthUser(user),
    otpEmailSent,
  };
}

// Maximum failed attempts before temporary lockout
const MAX_LOGIN_ATTEMPTS = 10;
// Lockout duration in minutes
const LOCKOUT_MINUTES = 15;

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // 1. Find user (select lockout fields)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, name: true, email: true, password: true, phoneNo: true,
      roles: true, profileComplete: true, isEmailVerified: true,
      loginAttempts: true, lockedUntil: true, deletedAt: true,
      isSuspended: true, suspendedUntil: true, suspensionReason: true,
    },
  });
  if (!user) throw createError("Invalid email or password", 400);

  // 2. Reject soft-deleted accounts early (belt-and-suspenders for non-token flows)
  if (user.deletedAt) throw createError("Invalid email or password", 400);

  // 3. Account lockout check
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw createError(
      `Account temporarily locked due to too many failed attempts. Try again in ${remaining} minute${remaining === 1 ? "" : "s"}.`,
      429
    );
  }

  // 4. Compare password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    const newAttempts = user.loginAttempts + 1;
    const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : undefined,
      },
    });
    if (shouldLock) {
      auditLog("auth.account_locked", { userId: user.id, email: user.email, detail: { attempts: newAttempts } });
      throw createError(
        `Account locked for ${LOCKOUT_MINUTES} minutes after too many failed attempts.`,
        429
      );
    }
    auditLog("auth.login_failure", { userId: user.id, email: user.email, detail: { attempt: newAttempts } });
    throw createError("Invalid email or password", 400);
  }

  // 5. Require email verification. Attach a machine-readable code so the
  //    client can route the user to the verify-email screen instead of
  //    string-matching the message.
  if (!user.isEmailVerified) {
    throw createError(
      "Please verify your email address before logging in.",
      403,
      { code: "EMAIL_NOT_VERIFIED" }
    );
  }

  // 6. Block suspended/banned accounts before issuing tokens
  assertNotSuspended(user);

  // 7. Reset lockout counters on successful login
  await prisma.user.update({
    where: { id: user.id },
    data: { loginAttempts: 0, lockedUntil: null, lastSeen: new Date() },
  });

  // 7. Sign access token + issue refresh token
  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = await createRefreshToken(user.id);

  auditLog("auth.login_success", { userId: user.id, email: user.email });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user as any),
  };
}

// ─── Forgot Password ───────────────────────────────────

export async function forgotPassword(
  input: ForgotPasswordInput
): Promise<{ message: string }> {
  const { email } = input;

  // Always return same message to prevent email enumeration
  const SAFE_MESSAGE =
    "If an account with that email exists, a reset code has been sent.";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: SAFE_MESSAGE };

  // Create a 6-digit reset OTP
  const rawOtp = await createPasswordResetOtp(user.id);

  // Awaited so a send failure is visible instead of claiming "sent" when it
  // wasn't. Safe to report honestly — we're already past the account-exists
  // branch (the SAFE_MESSAGE above still covers "no such account" exactly
  // as before), so an honest failure here doesn't add an enumeration signal
  // beyond what a rare, non-attacker-controlled delivery failure already is.
  try {
    await sendPasswordResetOtpEmail(user.email, user.name, rawOtp);
  } catch (err) {
    console.error("[EmailService] Failed to send reset email:", err);
    throw createError(
      "We couldn't send the reset code right now. Please try again in a moment.",
      502
    );
  }

  return { message: SAFE_MESSAGE };
}

// ─── Reset Password ────────────────────────────────────

export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ message: string }> {
  const { email, otp, password } = input;

  // 1. Resolve the user by email, then validate the OTP against that user.
  //    Use the same generic message for an unknown email as for a bad code
  //    so this endpoint can't be used to enumerate accounts.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw createError("Invalid or expired reset code.", 400);
  }

  const userId = await validatePasswordResetOtp(user.id, otp);

  // 2. Hash new password
  const hashedPassword = await hashPassword(password);

  // 3. Update password + revoke all refresh tokens (force re-login)
  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    }),
    revokeAllUserRefreshTokens(userId),
  ]);

  // 4. Delete used reset OTP
  await deletePasswordResetOtp(userId);

  auditLog("auth.password_reset", { userId });

  return { message: "Password reset successfully. Please log in with your new password." };
}

// ─── Delete Account ────────────────────────────────────
// Soft-delete: anonymise all PII in place, then revoke sessions and tokens.
// The User row is kept so foreign-key references (forum posts, chat senderIds)
// resolve to "Deleted User" rather than erroring. The account cannot be
// recovered or logged into after this point.

export async function deleteAccount(userId: string): Promise<{ message: string }> {
  await prisma.$transaction(async (tx) => {
    // 1. Anonymise the user row — unique email keeps the constraint satisfied
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        email: `deleted_${userId}@digiability.deleted`,
        phoneNo: null,
        deletedAt: new Date(),
        isEmailVerified: false,
        profileComplete: false,
        roles: [],
      },
    });

    // 2. Zero out all PII in the profile
    await tx.userProfile.updateMany({
      where: { userId },
      data: {
        fullName: null,
        username: null,
        dob: null,
        gender: null,
        city: null,
        state: null,
        disabilityType: null,
        disabilitySince: null,
        supportNeeded: null,
        carePersonName: null,
        careRelation: null,
        careDob: null,
        careDisabilityType: null,
        speciality: null,
        organization: null,
        yearsOfExperience: null,
        ngoName: null,
        ngoRole: null,
        district: null,
        verificationDoc: null,
      },
    });

    // 3. Revoke all auth tokens so existing sessions stop working immediately
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.passwordResetToken.deleteMany({ where: { userId } });

    // 4. Remove device tokens so no further push notifications are sent
    await tx.deviceToken.deleteMany({ where: { userId } });

    // 5. Scrub text content from moderation flags authored by this user (DPDP §13).
    //    The flag record itself is kept for audit integrity; only the content snippet
    //    and AI raw response (which may contain the original text) are cleared.
    await tx.moderationFlag.updateMany({
      where: { userId },
      data: { text: null, rawResponse: null },
    });
  });

  auditLog("auth.account_deleted", { userId });

  // 6. Best-effort: notify chat-svc to remove the user from all conversations.
  //    Fire-and-forget — a failure here does not roll back the deletion.
  const chatSvcUrl = process.env.CHAT_SVC_URL;
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (chatSvcUrl && internalSecret) {
    fetch(`${chatSvcUrl}/api/internal/users/${userId}/memberships`, {
      method: "DELETE",
      headers: {
        "x-internal-secret": internalSecret,
        "x-internal-ts": String(Date.now()),
      },
    }).catch((err) => {
      console.error("[deleteAccount] chat-svc membership cleanup failed:", err);
    });
  }

  // 7. Best-effort: notify forum-svc to anonymise the user's forum content.
  //    Forum posts are attributed to "Deleted User" rather than removed, to
  //    preserve discussion threads. The authorId FK still resolves (soft-deleted user row).
  const forumSvcUrl = process.env.FORUM_SVC_URL;
  if (forumSvcUrl && internalSecret) {
    fetch(`${forumSvcUrl}/api/internal/users/${userId}/content`, {
      method: "DELETE",
      headers: {
        "x-internal-secret": internalSecret,
        "x-internal-ts": String(Date.now()),
      },
    }).catch((err) => {
      console.error("[deleteAccount] forum-svc content anonymisation failed:", err);
    });
  }

  return { message: "Your account has been permanently deleted." };
}

// ─── Get Current User ──────────────────────────────────

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNo: true,
      roles: true,
      profileComplete: true,
      lastSeen: true,
      isEmailVerified: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("User not found");
  return {
    ...user,
    role: user.roles[0] || null,
    isSuspended: isCurrentlySuspended(user),
  };
}

// Must match the Prisma Role enum exactly
const VALID_ROLES: string[] = [
  'pwd', 'caregiver', 'therapist', 'ngo', 'volunteer', 'student', 'mentor',
];

export async function updateUserRole(userId: string, input: UpdateRoleInput) {
  const { role, roles } = input as any;
  let dbRoles: Role[] = [];
  if (roles && Array.isArray(roles)) {
    const invalid = roles.filter((r: string) => !VALID_ROLES.includes(r));
    if (invalid.length > 0) {
      throw createError(`Invalid role(s): ${invalid.join(', ')}`, 400);
    }
    dbRoles = roles.map((r: string) => r as Role);
  } else if (role) {
    if (!VALID_ROLES.includes(role)) {
      throw createError(`Invalid role: ${role}`, 400);
    }
    dbRoles = [role as Role];
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { roles: dbRoles },
    select: {
      id: true,
      name: true,
      email: true,
      roles: true,
      profileComplete: true,
      isEmailVerified: true,
    },
  });

  return { 
    message: "Role updated successfully", 
    user: {
      ...user,
      role: user.roles[0] || null,
    } 
  };
}

// ─── Batch User Lookup ─────────────────────────────────
// Returns minimal user info (id, name, deletedAt, isSuspended) for a list of
// IDs. Used by the mobile app to resolve participant names in
// conversation lists without making N+1 requests. deletedAt lets
// clients distinguish a soft-deleted account from a real user who
// happens to be named "Deleted User". isSuspended lets clients render
// "Name (Inactive)" for suspended-but-not-deleted accounts.

export async function getUsersByIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return [];
  if (uniqueIds.length > 100) {
    throw createError("Too many IDs — max 100 per request", 400);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      isSuspended: true,
    },
  });

  return users;
}

// ─── Device Token ─────────────────────────────────────
// Registers an Expo push token for a user device.
// One user can have multiple tokens (multiple devices).
// Upserts on token to avoid duplicates.

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  await prisma.deviceToken.upsert({
    where: { token },
    update: { userId, platform, updatedAt: new Date() },
    create: { userId, token, platform },
  });
}

export async function removeDeviceToken(
  userId: string,
  token: string
): Promise<void> {
  await prisma.deviceToken.deleteMany({
    where: { userId, token },
  });
}

// ─── User Search ───────────────────────────────────────
// Searches users by name (case-insensitive partial match).
// Used by the mobile app to find community members when
// creating Care Circles (group conversations).

export async function searchUsers(query: string, excludeUserId?: string) {
  if (!query || query.trim().length < 1) return [];
  // Bound query length to prevent excessively long DB patterns
  const safeQuery = query.trim().slice(0, 100);

  const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { name: { contains: safeQuery, mode: "insensitive" } },
        { id: { notIn: [excludeUserId, BOT_USER_ID].filter(Boolean) as string[] } },
        { isEmailVerified: true },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  return users;
}

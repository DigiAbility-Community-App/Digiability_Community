import prisma from "../models/prisma.client";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { createError } from "../middleware/error.middleware";
import { assertNotSuspended, isCurrentlySuspended } from "../utils/suspension.util";
import {
  createEmailVerificationOtp,
  validateEmailVerificationOtp,
  deleteEmailVerificationOtp,
  createSession,
  createPasswordResetOtp,
  validatePasswordResetOtp,
  deletePasswordResetOtp,
  revokeAllUserSessions,
  broadcastSessionsEnded,
} from "./token.service";
import {
  sendVerificationOtpEmail,
  sendPasswordResetOtpEmail,
} from "./email.service";
import { auditLog } from "./audit.service";
import {
  recordRegistrationConsents,
  CURRENT_POLICY_VERSION,
  CURRENT_CONSENT_NOTICE_VERSION,
  needsPolicyReacceptance,
  needsDataConsent,
} from "./consent.service";
import { eraseCrossServiceContent, recordErasureOutcome } from "./erasure.service";
import { RETENTION_DAYS } from "../config/retention.config";
import { checkAgeEligibility } from "../utils/age.util";
import { maskEmailForDisplay } from "../utils/mask.util";
import { checkMinorFlag } from "./profileService";
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
  otp: string,
  userAgent?: string
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
  const { accessToken, refreshToken } = await createSession(verifiedUser, userAgent);

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
    /** YYYY-MM-DD, or null for pre-age-gate accounts. Captured at signup and
     *  reused to prefill the onboarding profile form so the user isn't asked
     *  for their date of birth twice. */
    dateOfBirth: string | null;
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
  dateOfBirth?: Date | null;
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
    // Date-only (YYYY-MM-DD): the stored value is a UTC midnight, so slicing
    // the ISO string avoids the local-timezone shift toISOString+format would
    // introduce and keeps it comparable to what the client sent at signup.
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
  };
}

export async function registerUser(
  input: RegisterInput,
  ip?: string
): Promise<RegisterResult> {
  const { name, email, password, role, roles, phoneNo, policyVersion, consentNoticeVersion, dateOfBirth } = input as any;

  // ── Age gate (DPDP §9) ──────────────────────────────────
  // The server is the gate: a request that bypasses the app entirely is
  // rejected by the same rule the UI enforces. Previously checkMinorFlag only
  // wrote an audit line and explicitly did not block, and date of birth was an
  // optional profile field most accounts never filled in.
  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const ageCheck = checkAgeEligibility(dob);
  if (!ageCheck.eligible) {
    auditLog("auth.register_blocked_underage", {
      email,
      detail: { age: ageCheck.age, reason: ageCheck.reason },
    });
    throw createError(ageCheck.reason, 400);
  }

  // A client on an old build might send acceptance of policy text the user
  // was never actually shown. Rather than silently stamp today's version onto
  // a stale acceptance, refuse the registration and tell the client to update.
  if (policyVersion !== CURRENT_POLICY_VERSION) {
    throw createError(
      "The Terms of Use and Community Guidelines have been updated. Please refresh and review the latest version before continuing.",
      409
    );
  }

  // Same rule for the data-processing notice: consent only counts for the
  // notice text the user was actually shown.
  if (consentNoticeVersion !== CURRENT_CONSENT_NOTICE_VERSION) {
    throw createError(
      "Our data-processing notice has been updated. Please update the app and review it before continuing.",
      409
    );
  }

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

  const userData: any = {
    name,
    email,
    password: hashedPassword,
    roles: dbRoles,
    isEmailVerified: false,
    dateOfBirth: dob,
  };
  if (phoneNo && typeof phoneNo === 'string' && phoneNo.trim()) {
    userData.phoneNo = phoneNo.trim();
  }

  // User creation and consent recording happen in one transaction: a failure
  // recording consent must not leave a created account with no consent row and
  // an email that's now taken with no way to retry registration.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: userData });
    // Records DATA_PROCESSING, TERMS_OF_USE and COMMUNITY_GUIDELINES (DPDP §6).
    // Previously fire-and-forget outside any transaction, which meant a slow
    // or failed write left no record at all while registration still reported
    // success — defeating the point of a consent record.
    await recordRegistrationConsents(created.id, ip, tx);
    return created;
  });

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

export async function loginUser(input: LoginInput, userAgent?: string): Promise<LoginResult> {
  const { email, password } = input;

  // 1. Find user (select lockout fields)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, name: true, email: true, password: true, phoneNo: true,
      roles: true, profileComplete: true, isEmailVerified: true,
      loginAttempts: true, lockedUntil: true, deletedAt: true,
      isSuspended: true, suspendedUntil: true, suspensionReason: true,
      // Returned to the client so the onboarding profile form can prefill it
      // — without this the select would omit it and toAuthUser would report
      // null for every logged-in user.
      dateOfBirth: true,
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

  // 7. Start a session: access token (bound to it via `sid`) + refresh token
  const { accessToken, refreshToken } = await createSession(user, userAgent);

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

  // 3. Update password, then end every session on every device — access
  // tokens included, not just refresh tokens (force re-login everywhere).
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });
  await revokeAllUserSessions(userId, "password_reset");

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

export async function deleteAccount(
  userId: string,
  password: string
): Promise<{ message: string }> {
  // Re-authenticate before destroying anything. A valid access token alone used
  // to be enough, which meant an unlocked phone was sufficient to irreversibly
  // delete someone's account.
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true, email: true, phoneNo: true, createdAt: true, deletedAt: true },
  });
  if (!account || account.deletedAt) {
    throw createError("Account not found", 404);
  }
  const passwordValid = await comparePassword(password, account.password);
  if (!passwordValid) {
    auditLog("auth.account_deletion_denied", { userId });
    throw createError("Incorrect password", 401);
  }

  // Collected before the transaction deletes them, so the revocation can be
  // broadcast afterwards (instant 401s, and chat WebSockets dropped).
  const endedSessions = await prisma.session.findMany({
    where: { userId, revokedAt: null },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    // 0. Seal a minimal registration record BEFORE anonymising, because the
    //    anonymisation below overwrites the very fields it has to preserve.
    //    The Information Technology (Intermediary Guidelines) Rules 2021 require
    //    registration information be retained for 180 days after cancellation.
    //    Nothing else survives — see docs/legal/05.
    const purgeAfter = new Date();
    purgeAfter.setDate(purgeAfter.getDate() + RETENTION_DAYS.registrationRecords);
    await tx.registrationRecord.upsert({
      where: { userId },
      create: {
        userId,
        email: account.email,
        phoneNo: account.phoneNo,
        registeredAt: account.createdAt,
        purgeAfter,
      },
      update: {},
    });

    // 1. Anonymise the user row — unique email keeps the constraint satisfied
    await tx.user.update({
      where: { id: userId },
      data: {
        name: "Deleted User",
        email: `deleted_${userId}@digiability.deleted`,
        phoneNo: null,
        dateOfBirth: null,
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
    await tx.session.deleteMany({ where: { userId } });
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
  await broadcastSessionsEnded(userId, endedSessions.map((s) => s.id));

  // 6. Erase content owned by the other services. Awaited and recorded, rather
  //    than the fire-and-forget it used to be — a failure here is now visible
  //    and retried by the retention worker instead of silently dropped.
  const outcome = await eraseCrossServiceContent(userId);
  await recordErasureOutcome(userId, outcome);

  // Deliberately not "permanently deleted": this is immediate anonymisation
  // plus a sealed 180-day registration record the law requires us to keep.
  // Claiming more than that would be untrue. See docs/legal/05.
  return {
    message:
      "Your account has been deleted and your personal information erased. " +
      "As Indian law requires, a minimal registration record is kept for 180 days and then destroyed.",
  };
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
      dateOfBirth: true,
      isSuspended: true,
      suspendedUntil: true,
      suspensionReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw createError("User not found", 404);

  // Surfaced so the client can intercept with a re-acceptance prompt. This is
  // also the annual-notice mechanism: bumping CURRENT_POLICY_VERSION puts
  // every existing user back into this state on their next session restore.
  const policyReacceptanceRequired = await needsPolicyReacceptance(userId);

  // True until the user has consented to the CURRENT data-processing notice —
  // including every account that predates the separate notice (DPDP §5/§6).
  const dataConsentRequired = await needsDataConsent(userId);

  // Accounts created before the age gate have no recorded date of birth,
  // because it used to be an optional profile field. They are asked for it at
  // the same interception point, so the population converges instead of
  // drifting indefinitely (docs/legal/06 §2.4).
  const dateOfBirthRequired = user.dateOfBirth === null;

  return {
    ...user,
    role: user.roles[0] || null,
    isSuspended: isCurrentlySuspended(user),
    policyReacceptanceRequired,
    dataConsentRequired,
    dateOfBirthRequired,
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
// Resolves display names for users the requester is allowed to see
// (VAPT M-002 / OWASP API1:2023). chat-svc stores only userIds, so clients
// look names up here; without a check, any account could enumerate any other.
//
// A user is returned only if they are:
//   • the requester themselves;
//   • a current or former member of a conversation the requester is an
//     active member of (participant lists, and group history showing
//     people who left);
//   • the invitee on an invite to a conversation the requester is an active
//     admin of (reviewing invites and join requests — chat-svc only shows
//     that list to admins; admin roles mirror chat-svc's hasAdminAccess:
//     OWNER/ADMIN in groups, OWNER/CAREGIVER in Care Circles);
//   • someone who invited the requester.
// Soft-deleted accounts are never returned; clients show a missing id as
// "This user no longer exists". Unauthorised ids are omitted rather than rejected with a
// 403, so the response doesn't reveal whether an id shares a conversation.
//
// The filter runs in Postgres in one query. It reads chat-svc's tables in the
// `chat` schema with raw SQL instead of Prisma models: declaring chat models
// in this service's schema would let user-svc's `prisma db push` try to
// manage tables it doesn't own.

export interface PublicUserDTO {
  id: string;
  name: string;
}

export async function getUsersByIds(requesterId: string, ids: string[]): Promise<PublicUserDTO[]> {
  if (ids.length === 0) return [];

  return prisma.$queryRaw<PublicUserDTO[]>`
    SELECT u.id, u.name
    FROM public.users u
    WHERE u.id = ANY(${ids}::text[])
      AND u."deletedAt" IS NULL
      AND (
        u.id = ${requesterId}
        OR EXISTS (
          SELECT 1
          FROM chat.conversation_members mine
          JOIN chat.conversations c ON c.id = mine."conversationId" AND c."deletedAt" IS NULL
          JOIN chat.conversation_members theirs ON theirs."conversationId" = mine."conversationId"
          WHERE mine."userId" = ${requesterId}
            AND mine."leftAt" IS NULL
            AND theirs."userId" = u.id
        )
        OR EXISTS (
          SELECT 1
          FROM chat.conversation_members mine
          JOIN chat.conversations c ON c.id = mine."conversationId" AND c."deletedAt" IS NULL
          JOIN chat.group_invites gi ON gi."conversationId" = mine."conversationId"
          WHERE mine."userId" = ${requesterId}
            AND mine."leftAt" IS NULL
            AND (
              mine.role = 'OWNER'
              OR (c."subType" = 'CARE_CIRCLE' AND mine.role = 'CAREGIVER')
              OR (c."subType" IS DISTINCT FROM 'CARE_CIRCLE' AND mine.role = 'ADMIN')
            )
            AND gi."inviteeId" = u.id
        )
        OR EXISTS (
          SELECT 1
          FROM chat.group_invites gi
          WHERE gi."inviteeId" = ${requesterId}
            AND gi."inviterId" = u.id
        )
      )
  `;
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

  // Mask before returning. The member picker shows this under the name to tell
  // two people with the same name apart, so it can't be dropped — but handing
  // out full addresses to anyone who types a letter is a harvesting surface.
  return users.map((u) => ({
    ...u,
    email: maskEmailForDisplay(u.email),
  }));
}

// ─── Date-of-birth backfill ────────────────────────────
// For accounts created before the age gate existed. Reached from the same
// interception point as policy re-acceptance (docs/legal/06 §2.4).
//
// An under-18 declaration here is routed to the moderation queue rather than
// deleting the account outright: the likeliest cause of a surprising date is a
// typo, and Terms §2 commits to termination by decision, not automatically.

export async function submitDateOfBirth(
  userId: string,
  dateOfBirth: string
): Promise<{ eligible: boolean; message: string }> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { dateOfBirth: true },
  });
  if (!existing) throw createError("Account not found", 404);

  // Write-once: this is an eligibility fact, not an editable preference. Letting
  // it be rewritten would let a flagged account clear its own flag.
  if (existing.dateOfBirth) {
    throw createError(
      "Your date of birth is already on record. Contact support if it needs correcting.",
      409
    );
  }

  const dob = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const check = checkAgeEligibility(dob);

  if (!check.eligible && check.age !== null && check.age >= 0 && check.age <= 120) {
    // A plausible date that happens to be under 18: record it and refer to a
    // human. Storing it matters — otherwise the next prompt asks again and the
    // account never resolves either way.
    await prisma.user.update({ where: { id: userId }, data: { dateOfBirth: dob } });
    await checkMinorFlag(userId, dob);
    return {
      eligible: false,
      message:
        "Thanks. Digiability Community is for people aged 18 and over, so our team will review your account. If this date is wrong, please contact support.",
    };
  }

  if (!check.eligible) {
    // Nonsense date — don't persist it, just ask again.
    throw createError(check.reason, 400);
  }

  await prisma.user.update({ where: { id: userId }, data: { dateOfBirth: dob } });
  return { eligible: true, message: "Thank you." };
}

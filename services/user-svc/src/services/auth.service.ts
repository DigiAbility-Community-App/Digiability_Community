import prisma from "../models/prisma.client";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { signAccessToken } from "../utils/jwt.util";
import { createError } from "../middleware/error.middleware";
import {
  createEmailVerificationOtp,
  validateEmailVerificationOtp,
  deleteEmailVerificationOtp,
  createRefreshToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  deletePasswordResetToken,
  revokeAllUserRefreshTokens,
} from "./token.service";
import {
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
} from "./email.service";
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
): Promise<{ message: string }> {
  // 1. Find user by email
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw createError("Invalid email or OTP", 400);

  // 2. Validate OTP
  await validateEmailVerificationOtp(user.id, otp);

  // 3. Mark user as verified
  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true },
  });

  // 4. Delete used OTP
  await deleteEmailVerificationOtp(user.id);

  return { message: "Email verified successfully. You can now log in." };
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
  const recentOtp = await prisma.emailVerificationOtp.findFirst({
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
  sendVerificationOtpEmail(user.email, user.name, rawOtp).catch((err) =>
    console.error("[EmailService] Failed to send verification OTP:", err)
  );

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
    profileComplete: boolean;
    isEmailVerified: boolean;
  };
}

function toAuthUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role | null;
  profileComplete: boolean;
  isEmailVerified: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileComplete: user.profileComplete,
    isEmailVerified: user.isEmailVerified,
  };
}

export async function registerUser(input: RegisterInput): Promise<LoginResult> {
  const { name, email, password, role } = input;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw createError("An account with this email already exists", 400);
  }

  const hashedPassword = await hashPassword(password);

  const dbRole = role ? (role as Role) : null;

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: dbRole },
  });

  const rawOtp = await createEmailVerificationOtp(user.id);
  sendVerificationOtpEmail(user.email, user.name, rawOtp).catch((err) =>
    console.error("[EmailService] Failed to send verification OTP:", err)
  );

  const accessToken = signAccessToken({ sub: user.id, email: user.email });
  const refreshToken = await createRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw createError("Invalid email or password", 400);

  // 2. Compare password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) throw createError("Invalid email or password", 400);

  // 3. Sign access token
  const accessToken = signAccessToken({ sub: user.id, email: user.email });

  // 4. Create refresh token
  const refreshToken = await createRefreshToken(user.id);

  // 5. Update lastSeen
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user),
  };
}

// ─── Forgot Password ───────────────────────────────────

export async function forgotPassword(
  input: ForgotPasswordInput
): Promise<{ message: string }> {
  const { email } = input;

  // Always return same message to prevent email enumeration
  const SAFE_MESSAGE =
    "If an account with that email exists, a reset link has been sent.";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { message: SAFE_MESSAGE };

  // Create reset token
  const rawToken = await createPasswordResetToken(user.id);

  // Send email (non-blocking)
  sendPasswordResetEmail(user.email, user.name, rawToken).catch((err) =>
    console.error("[EmailService] Failed to send reset email:", err)
  );

  return { message: SAFE_MESSAGE };
}

// ─── Reset Password ────────────────────────────────────

export async function resetPassword(
  input: ResetPasswordInput
): Promise<{ message: string }> {
  const { token, password } = input;

  // 1. Validate token
  const userId = await validatePasswordResetToken(token);

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

  // 4. Delete used reset token
  await deletePasswordResetToken(token);

  return { message: "Password reset successfully. Please log in with your new password." };
}

// ─── Delete Account ────────────────────────────────────

export async function deleteAccount(userId: string): Promise<{ message: string }> {
  // Cascade deletes all related tokens via Prisma schema (onDelete: Cascade)
  await prisma.user.delete({ where: { id: userId } });
  return { message: "Account deleted successfully." };
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
      role: true,
      profileComplete: true,
      lastSeen: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("User not found");
  return user;
}

export async function updateUserRole(userId: string, input: UpdateRoleInput) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: input.role as Role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileComplete: true,
      isEmailVerified: true,
    },
  });
  return { message: "Role updated successfully", user };
}

// ─── Batch User Lookup ─────────────────────────────────
// Returns minimal user info (id, name) for a list of IDs.
// Used by the mobile app to resolve participant names in
// conversation lists without making N+1 requests.

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
    },
  });

  return users;
}

// ─── User Search ───────────────────────────────────────
// Searches users by name (case-insensitive partial match).
// Used by the mobile app to find community members when
// creating Care Circles (group conversations).

export async function searchUsers(query: string, excludeUserId?: string) {
  if (!query || query.trim().length < 1) return [];

  const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { name: { contains: query.trim(), mode: "insensitive" } },
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

import prisma from "../models/prisma.client";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { signAccessToken } from "../utils/jwt.util";
import {
  createEmailVerificationToken,
  validateEmailVerificationToken,
  deleteEmailVerificationToken,
  createRefreshToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  deletePasswordResetToken,
  revokeAllUserRefreshTokens,
} from "./token.service";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "./email.service";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "../utils/validation.util";

// ─────────────────────────────────────────────────────
// Auth Service — Core business logic
// ─────────────────────────────────────────────────────

// ─── Register ──────────────────────────────────────────

export async function registerUser(input: RegisterInput): Promise<{ message: string }> {
  const { name, email, password } = input;

  // 1. Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  // 2. Hash password
  const hashedPassword = await hashPassword(password);

  // 3. Create user
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  // 4. Create email verification token
  const rawToken = await createEmailVerificationToken(user.id);

  // 5. Send verification email (non-blocking — don't await to keep response fast)
  sendVerificationEmail(user.email, user.name, rawToken).catch((err) =>
    console.error("[EmailService] Failed to send verification email:", err)
  );

  return { message: "Account created. Please check your email to verify your account." };
}

// ─── Email Verification ────────────────────────────────

export async function verifyEmail(rawToken: string): Promise<{ message: string }> {
  // 1. Validate token
  const userId = await validateEmailVerificationToken(rawToken);

  // 2. Mark user as verified
  await prisma.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });

  // 3. Delete used token
  await deleteEmailVerificationToken(rawToken);

  return { message: "Email verified successfully. You can now log in." };
}

// ─── Login ─────────────────────────────────────────────

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    isEmailVerified: boolean;
  };
}

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid email or password");

  // 2. Compare password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) throw new Error("Invalid email or password");

  // 3. Check email verification
  if (!user.isEmailVerified) {
    throw new Error(
      "Please verify your email before logging in. Check your inbox."
    );
  }

  // 4. Sign access token
  const accessToken = signAccessToken({ sub: user.id, email: user.email });

  // 5. Create refresh token
  const refreshToken = await createRefreshToken(user.id);

  // 6. Update lastSeen
  await prisma.user.update({
    where: { id: user.id },
    data: { lastSeen: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
    },
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
      dob: true,
      lastSeen: true,
      isEmailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("User not found");
  return user;
}

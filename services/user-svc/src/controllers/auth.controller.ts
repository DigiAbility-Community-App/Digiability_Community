import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import {
  registerUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  deleteAccount,
  getCurrentUser,
} from "../services/auth.service";
import { rotateRefreshToken, revokeRefreshToken } from "../services/token.service";
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
} from "../utils/cookie.util";

// ─────────────────────────────────────────────────────
// Auth Controller
// Thin layer: parse input → call service → format response
// ─────────────────────────────────────────────────────

// ─── POST /auth/register ───────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  res.status(201).json({ success: true, message: result.message, data: {} });
});

// ─── GET /auth/verify-email?token= ────────────────────
export const verifyEmailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) throw createError("Verification token is required", 400);

    const result = await verifyEmail(token);
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── POST /auth/login ──────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await loginUser(req.body);

  // Set refresh token in HTTP-only cookie
  setRefreshTokenCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: { accessToken, user },
  });
});

// ─── POST /auth/refresh ────────────────────────────────
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = getRefreshTokenFromCookie(req.cookies);
  if (!rawToken) throw createError("No refresh token found. Please log in.", 401);

  const { accessToken, refreshToken: newRefreshToken } =
    await rotateRefreshToken(rawToken);

  // Set rotated token as new cookie
  setRefreshTokenCookie(res, newRefreshToken);

  res.status(200).json({
    success: true,
    message: "Token refreshed",
    data: { accessToken },
  });
});

// ─── POST /auth/logout ─────────────────────────────────
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken = getRefreshTokenFromCookie(req.cookies);

  if (rawToken) {
    await revokeRefreshToken(rawToken);
  }

  clearRefreshTokenCookie(res);

  res.status(200).json({
    success: true,
    message: "Logged out successfully",
    data: {},
  });
});

// ─── POST /auth/forgot-password ────────────────────────
export const forgotPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await forgotPassword(req.body);
    // Always 200 to prevent email enumeration
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── POST /auth/reset-password ─────────────────────────
export const resetPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await resetPassword(req.body);
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── DELETE /auth/delete-account ──────────────────────
export const deleteAccountHandler = asyncHandler(
  async (req: Request, res: Response) => {
    // req.user is set by authenticate middleware
    const userId = req.user!.sub;
    const result = await deleteAccount(userId);
    clearRefreshTokenCookie(res);
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── GET /auth/me ──────────────────────────────────────
export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const user = await getCurrentUser(userId);
  res.status(200).json({ success: true, message: "User fetched", data: { user } });
});

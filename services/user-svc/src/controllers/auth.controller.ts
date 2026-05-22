import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import {
  registerUser,
  verifyEmailOtp,
  resendVerificationOtp,
  loginUser,
  forgotPassword,
  resetPassword,
  deleteAccount,
  getCurrentUser,
  updateUserRole,
  getUsersByIds,
  searchUsers,
} from "../services/auth.service";
import { rotateRefreshToken, revokeRefreshToken } from "../services/token.service";
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromCookie,
  getRefreshTokenFromAuthHeader,
  setRefreshTokenHeader,
} from "../utils/cookie.util";

// ─────────────────────────────────────────────────────
// Auth Controller
// Thin layer: parse input → call service → format response
// ─────────────────────────────────────────────────────

function attachRefreshToken(res: Response, refreshToken: string) {
  setRefreshTokenCookie(res, refreshToken);
  setRefreshTokenHeader(res, refreshToken);
}

// ─── POST /auth/register ───────────────────────────────
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await registerUser(req.body);

  attachRefreshToken(res, refreshToken);

  res.status(201).json({
    success: true,
    message: "Account created successfully. Please verify your email with the OTP sent.",
    data: { accessToken, user },
  });
});

// ─── POST /auth/verify-email ──────────────────────────
export const verifyEmailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const result = await verifyEmailOtp(email, otp);
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── POST /auth/resend-otp ────────────────────────────
export const resendOtpHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await resendVerificationOtp(email);
    res.status(200).json({ success: true, message: result.message, data: {} });
  }
);

// ─── POST /auth/login ──────────────────────────────────
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { accessToken, refreshToken, user } = await loginUser(req.body);

  attachRefreshToken(res, refreshToken);

  res.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: { accessToken, user },
  });
});

// ─── POST /auth/refresh ────────────────────────────────
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const rawToken =
    getRefreshTokenFromCookie(req.cookies) ??
    getRefreshTokenFromAuthHeader(req.headers.authorization);
  if (!rawToken) throw createError("No refresh token found. Please log in.", 401);

  const { accessToken, refreshToken: newRefreshToken } =
    await rotateRefreshToken(rawToken);

  attachRefreshToken(res, newRefreshToken);

  res.status(200).json({
    success: true,
    message: "Token refreshed",
    data: { accessToken },
  });
});

// ─── POST /auth/logout ─────────────────────────────────
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const rawToken =
    getRefreshTokenFromCookie(req.cookies) ??
    getRefreshTokenFromAuthHeader(req.headers.authorization);

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

// ─── PATCH /auth/role ──────────────────────────────────
export const updateRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const result = await updateUserRole(userId, req.body);
  res.status(200).json({ success: true, message: result.message, data: result.user });
});

// ─── POST /auth/users/batch ────────────────────────────
// Returns minimal user info ({ id, name }) for a list of IDs.
// Used by chat screens to resolve participant display names.
export const batchLookupUsers = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({
      success: false,
      message: "ids must be a non-empty array of user IDs",
    });
    return;
  }

  const users = await getUsersByIds(ids);
  res.status(200).json({ success: true, data: { users } });
});

// ─── GET /auth/users/search ────────────────────────────
// Searches community members by name for group creation.
export const searchUsersHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q as string) || "";
  const userId = req.user!.sub;

  const users = await searchUsers(query, userId);
  res.status(200).json({ success: true, data: { users } });
});

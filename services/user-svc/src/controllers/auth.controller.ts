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
  registerDeviceToken,
  removeDeviceToken,
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
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
    req.socket.remoteAddress;
  const { accessToken, refreshToken, user } = await registerUser(req.body, ip);

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
  const rawRefreshToken =
    getRefreshTokenFromCookie(req.cookies) ??
    getRefreshTokenFromAuthHeader(req.headers.authorization);

  // Extract the current access token so its JTI can be blocklisted immediately.
  // The Authorization header here carries the access token (logout is a protected route).
  const rawAccessToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;

  if (rawRefreshToken) {
    // revokeRefreshToken also adds the access token JTI to the Redis blocklist
    await revokeRefreshToken(rawRefreshToken, rawAccessToken);
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
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const batchLookupUsers = asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({
      success: false,
      message: "ids must be a non-empty array of user IDs",
    });
    return;
  }

  // Validate each ID is a proper UUID to prevent DB errors and enumeration abuse
  const validIds = ids
    .filter((id): id is string => typeof id === "string" && UUID_REGEX.test(id))
    .slice(0, 100); // enforce cap

  if (validIds.length === 0) {
    res.status(400).json({ success: false, message: "No valid UUIDs provided" });
    return;
  }

  const users = await getUsersByIds(validIds);
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

// ─── POST /auth/device-token ───────────────────────────
// Registers an Expo push token for the authenticated user.
export const registerDeviceTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { token, platform } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ success: false, message: "token is required" });
    return;
  }

  await registerDeviceToken(userId, token, platform || "unknown");
  res.status(200).json({ success: true, message: "Device token registered" });
});

// ─── DELETE /auth/device-token ─────────────────────────
// Removes an Expo push token (called on logout).
export const removeDeviceTokenHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    res.status(400).json({ success: false, message: "token is required" });
    return;
  }

  await removeDeviceToken(userId, token);
  res.status(200).json({ success: true, message: "Device token removed" });
});

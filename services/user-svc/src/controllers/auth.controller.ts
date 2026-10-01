import { Request, Response } from "express";
import { asyncHandler, createError } from "../middleware/error.middleware";
import prisma from "../models/prisma.client";
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
  submitDateOfBirth,
} from "../services/auth.service";
import {
  rotateRefreshToken,
  revokeSession,
  revokeSessionByRefreshToken,
  revokeAllUserSessions,
} from "../services/token.service";
import { verifyAccessTokenIgnoringExpiry } from "../utils/jwt.util";
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
// ─── POST /auth/check-email ────────────────────────────
// Public: lets the signup form tell the user an address is already
// registered while they type, instead of only after they submit the whole
// form. This does confirm whether an email has an account — but registration
// already reports exactly that ("An account with this email already exists"),
// so it discloses nothing new; it is rate-limited to keep enumeration
// expensive. Deliberately NOT used by forgot-password, which stays
// non-committal on purpose.
export const checkEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  // POST body, not a query string: an email in the URL ends up in access
  // and proxy logs (VAPT: sensitive information in URL).
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({
      success: false,
      available: false,
      message: "Enter a valid email address",
    });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    // deletedAt matters: a soft-deleted account still occupies the unique
    // email index, so registering it again would fail regardless.
    select: { id: true },
  });

  res.json({
    success: true,
    available: !existing,
    message: existing
      ? "An account with this email already exists"
      : "Email is available",
  });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  // req.ip honours `trust proxy`; raw X-Forwarded-For is client-controlled
  // and ends up on the consent record.
  const { user, otpEmailSent } = await registerUser(req.body, req.ip);

  // No tokens and no refresh cookie here — the session is issued by
  // /auth/verify-email once the OTP is confirmed. Handing out a session at
  // registration meant an unverified account could reach the API directly,
  // since nothing downstream re-checked isEmailVerified.
  res.status(201).json({
    success: true,
    message: otpEmailSent
      ? "Account created successfully. Please verify your email with the OTP sent."
      : "Account created successfully, but we couldn't send the verification email right now. Please use Resend OTP to try again.",
    data: { user, otpEmailSent, requiresVerification: true },
  });
});

// ─── POST /auth/verify-email ──────────────────────────
export const verifyEmailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    const { accessToken, refreshToken, user, message } = await verifyEmailOtp(email, otp, req.get("user-agent"));

    // Same cookie/header handling as the login path — this is now the point
    // where a session actually begins.
    attachRefreshToken(res, refreshToken);

    res.status(200).json({
      success: true,
      message,
      data: { accessToken, user },
    });
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
  const { accessToken, refreshToken, user } = await loginUser(req.body, req.get("user-agent"));

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
// Ends the caller's session: its access tokens stop working on their next
// request and its refresh token can't be used again. Works without a valid
// access token (expired, or already discarded by the client) by falling back
// to the refresh token from the body, cookie or x-refresh-token header.
// Always 200, so it can't be used to probe which tokens exist.
export const logout = asyncHandler(async (req: Request, res: Response) => {
  let revoked = false;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      // Signature still verified; only expiry is ignored.
      const { sid } = verifyAccessTokenIgnoringExpiry(authHeader.slice(7).trim());
      if (sid) revoked = await revokeSession(sid, "logout");
    } catch {
      // Not a token we signed — ignore and try the refresh token.
    }
  }

  if (!revoked) {
    const bodyToken =
      typeof req.body?.refreshToken === "string" ? req.body.refreshToken.trim() : "";
    const headerToken = req.get("x-refresh-token")?.trim() ?? "";
    const rawRefreshToken =
      bodyToken || headerToken || getRefreshTokenFromCookie(req.cookies);
    if (rawRefreshToken) await revokeSessionByRefreshToken(rawRefreshToken, "logout");
  }

  clearRefreshTokenCookie(res);
  res.status(200).json({ success: true, message: "Logged out successfully", data: {} });
});

// ─── POST /auth/logout-all ─────────────────────────────
// Ends every session the user has, on every device.
export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const count = await revokeAllUserSessions(req.user!.sub, "logout_all");
  clearRefreshTokenCookie(res);
  res.status(200).json({
    success: true,
    message: "Logged out of all devices",
    data: { sessionsEnded: count },
  });
});

// ─── POST /auth/forgot-password ────────────────────────
export const forgotPasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await forgotPassword(req.body);
    // Always 200 for the "does this account exist" question specifically —
    // that's what prevents email enumeration. A genuine send failure for an
    // account that DOES exist throws (502) rather than claiming success;
    // see forgotPassword()'s own comment for why that's still safe.
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

    // Re-authentication: a valid access token is no longer sufficient for an
    // irreversible destructive action.
    const { password } = req.body as { password?: string };
    if (!password || typeof password !== "string") {
      throw createError("Your password is required to delete your account.", 400);
    }

    const result = await deleteAccount(userId, password);
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
// Returns { id, name } for the requested users the caller is allowed to see.
// Body is validated by BatchLookupSchema (UUIDs, max 50, deduplicated).
export const batchLookupUsers = asyncHandler(async (req: Request, res: Response) => {
  const users = await getUsersByIds(req.user!.sub, req.body.ids);
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

// ─── GET /auth/maintenance ──────────────────────────────
// Returns the current platform maintenance mode status.
export const checkMaintenanceHandler = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result: Array<{ maintenance_mode: boolean; support_phone?: string; email_config?: string }> = await prisma.$queryRaw`
      SELECT maintenance_mode, support_phone, email_config FROM admin_general_settings WHERE id = 'default' LIMIT 1
    `;
    if (result.length > 0) {
      const row = result[0];
      return res.status(200).json({
        success: true,
        inMaintenance: Boolean(row.maintenance_mode),
        supportPhone: row.support_phone || "+91 88000 12345",
        supportEmail: row.email_config || "support@digiability.org",
      });
    }
    res.status(200).json({
      success: true,
      inMaintenance: false,
      supportPhone: "+91 88000 12345",
      supportEmail: "support@digiability.org",
    });
  } catch {
    res.status(200).json({
      success: true,
      inMaintenance: false,
      supportPhone: "+91 88000 12345",
      supportEmail: "support@digiability.org",
    });
  }
});

// ── POST /api/auth/date-of-birth ──────────────────────
// Backfill for accounts predating the age gate (docs/legal/06 §2.4).
export const submitDateOfBirthHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const { dateOfBirth } = req.body as { dateOfBirth?: string };

    if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
      throw createError("Date of birth must be in YYYY-MM-DD format.", 400);
    }

    const result = await submitDateOfBirth(userId, dateOfBirth);
    res.status(200).json({ success: true, message: result.message, data: { eligible: result.eligible } });
  }
);

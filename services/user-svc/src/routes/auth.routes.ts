import { Router } from "express";
import {
  register,
  verifyEmailHandler,
  resendOtpHandler,
  login,
  refresh,
  logout,
  logoutAll,
  forgotPasswordHandler,
  resetPasswordHandler,
  deleteAccountHandler,
  me,
  updateRoleHandler,
  batchLookupUsers,
  searchUsersHandler,
  registerDeviceTokenHandler,
  removeDeviceTokenHandler,
  checkMaintenanceHandler,
  submitDateOfBirthHandler,
  checkEmailHandler,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { enforcePasswordPolicy } from "../middleware/passwordPolicy.middleware";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  verifyOtpLimiter,
  resendOtpLimiter,
  resendOtpIpLimiter,
  checkEmailLimiter,
  loginAccountLimiter,
  verifyOtpAccountLimiter,
  forgotPasswordAccountLimiter,
  resetPasswordAccountLimiter,
} from "../middleware/rateLimit.middleware";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UpdateRoleSchema,
  VerifyOtpSchema,
  ResendOtpSchema,
  BatchLookupSchema,
} from "../utils/validation.util";

// ─────────────────────────────────────────────────────
// Auth Routes
// Base path: /api/auth  (mounted in index.ts)
// ─────────────────────────────────────────────────────

const router = Router();

// ── Public Routes ─────────────────────────────────────
router.get("/maintenance",                                                             checkMaintenanceHandler);
// Live availability check for the signup form — see checkEmailHandler.
router.post("/check-email",    checkEmailLimiter,                                      checkEmailHandler);
router.post("/register",       registerLimiter,      validate(RegisterSchema),       enforcePasswordPolicy(), register);
router.post("/login",          loginLimiter, loginAccountLimiter,             validate(LoginSchema),          login);
router.post("/refresh",                                                                refresh);
router.post("/logout",                                                                 logout);
router.post("/logout-all",     authenticate,                                          logoutAll);
router.post("/verify-email",   verifyOtpLimiter, verifyOtpAccountLimiter,     validate(VerifyOtpSchema),      verifyEmailHandler);
// Two limiters: per-email (the budget that protects the inbox) and a looser
// per-IP one (anti-abuse). Previously shared a single IP-keyed limiter with
// /verify-email, so mistyped codes consumed the resend budget.
router.post("/resend-otp",     resendOtpLimiter, resendOtpIpLimiter, validate(ResendOtpSchema), resendOtpHandler);
router.post("/forgot-password", passwordResetLimiter, forgotPasswordAccountLimiter, validate(ForgotPasswordSchema), forgotPasswordHandler);
router.post("/reset-password",  passwordResetLimiter, resetPasswordAccountLimiter, validate(ResetPasswordSchema),  enforcePasswordPolicy(), resetPasswordHandler);

// ── Protected Routes (require valid access token) ─────
router.get("/me",               authenticate,                                          me);
// Backfill for accounts created before the age gate existed.
router.post("/date-of-birth",   authenticate,                                          submitDateOfBirthHandler);
router.patch("/role",           authenticate, validate(UpdateRoleSchema),             updateRoleHandler);
router.post("/users/batch",     authenticate, validate(BatchLookupSchema),             batchLookupUsers);
router.get("/users/search",     authenticate,                                          searchUsersHandler);
router.delete("/delete-account", authenticate,                                         deleteAccountHandler);
router.post("/device-token",    authenticate,                                          registerDeviceTokenHandler);
router.delete("/device-token",  authenticate,                                          removeDeviceTokenHandler);

export default router;

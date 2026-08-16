import { Router } from "express";
import {
  register,
  verifyEmailHandler,
  resendOtpHandler,
  login,
  refresh,
  logout,
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
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
  otpLimiter,
} from "../middleware/rateLimit.middleware";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  UpdateRoleSchema,
  VerifyOtpSchema,
  ResendOtpSchema,
} from "../utils/validation.util";

// ─────────────────────────────────────────────────────
// Auth Routes
// Base path: /api/auth  (mounted in index.ts)
// ─────────────────────────────────────────────────────

const router = Router();

// ── Public Routes ─────────────────────────────────────
router.get("/maintenance",                                                             checkMaintenanceHandler);
router.post("/register",       registerLimiter,      validate(RegisterSchema),       register);
router.post("/login",          loginLimiter,          validate(LoginSchema),          login);
router.post("/refresh",                                                                refresh);
router.post("/logout",                                                                 logout);
router.post("/verify-email",   otpLimiter,            validate(VerifyOtpSchema),      verifyEmailHandler);
router.post("/resend-otp",     otpLimiter,            validate(ResendOtpSchema),      resendOtpHandler);
router.post("/forgot-password", passwordResetLimiter, validate(ForgotPasswordSchema), forgotPasswordHandler);
router.post("/reset-password",  passwordResetLimiter, validate(ResetPasswordSchema),  resetPasswordHandler);

// ── Protected Routes (require valid access token) ─────
router.get("/me",               authenticate,                                          me);
router.patch("/role",           authenticate, validate(UpdateRoleSchema),             updateRoleHandler);
router.post("/users/batch",     authenticate,                                          batchLookupUsers);
router.get("/users/search",     authenticate,                                          searchUsersHandler);
router.delete("/delete-account", authenticate,                                         deleteAccountHandler);
router.post("/device-token",    authenticate,                                          registerDeviceTokenHandler);
router.delete("/device-token",  authenticate,                                          removeDeviceTokenHandler);

export default router;

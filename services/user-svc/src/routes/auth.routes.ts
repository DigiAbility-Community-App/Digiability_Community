import { Router } from "express";
import {
  register,
  verifyEmailHandler,
  login,
  refresh,
  logout,
  forgotPasswordHandler,
  resetPasswordHandler,
  deleteAccountHandler,
  me,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "../utils/validation.util";

// ─────────────────────────────────────────────────────
// Auth Routes
// Base path: /api/auth  (mounted in index.ts)
// ─────────────────────────────────────────────────────

const router = Router();

// ── Public Routes ─────────────────────────────────────
router.post("/register",          validate(RegisterSchema),        register);
router.post("/login",             validate(LoginSchema),           login);
router.post("/refresh",                                            refresh);
router.post("/logout",                                             logout);
router.get("/verify-email",                                        verifyEmailHandler);
router.post("/forgot-password",   validate(ForgotPasswordSchema),  forgotPasswordHandler);
router.post("/reset-password",    validate(ResetPasswordSchema),   resetPasswordHandler);

// ── Protected Routes (require valid access token) ─────
router.get("/me",                 authenticate,                    me);
router.delete("/delete-account",  authenticate,                    deleteAccountHandler);

export default router;

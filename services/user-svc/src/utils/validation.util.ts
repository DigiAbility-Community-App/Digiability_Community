import { z } from "zod";

// ─────────────────────────────────────────────────────
// Zod Validation Schemas for Auth Endpoints
// ─────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100),
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must include uppercase, lowercase, and a number"
    ),
  role: z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "other"]).optional(),
  roles: z.array(z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "other"])).optional(),
});

export const LoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
  password: z.string({ required_error: "Password is required" }),
});

export const ForgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
});

export const ResetPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
  otp: z
    .string({ required_error: "Reset code is required" })
    .length(6, "Reset code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Reset code must be 6 digits"),
  password: z
    .string({ required_error: "New password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must include uppercase, lowercase, and a number"
    ),
});

export const UpdateRoleSchema = z.object({
  role: z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student"]).optional(),
  roles: z.array(z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student"])).optional(),
});

export const VerifyOtpSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
  otp: z
    .string({ required_error: "OTP is required" })
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const ResendOtpSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email address")
    .toLowerCase(),
});

export const ReportSchema = z.object({
  targetType: z.enum(["USER", "MESSAGE", "GROUP"], {
    required_error: "targetType is required",
    invalid_type_error: "targetType must be USER, MESSAGE, or GROUP",
  }),
  targetId: z
    .string({ required_error: "targetId is required" })
    .uuid("targetId must be a valid UUID"),
  reason: z.enum(
    ["SPAM", "HARASSMENT", "HATE_SPEECH", "INAPPROPRIATE_CONTENT", "MISINFORMATION", "IMPERSONATION", "OTHER"],
    {
      required_error: "reason is required",
      invalid_type_error: "Invalid reason value",
    }
  ),
  details: z.string().max(500, "Details cannot exceed 500 characters").optional(),
});

export type ReportInput = z.infer<typeof ReportSchema>;

// Inferred types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof ResendOtpSchema>;

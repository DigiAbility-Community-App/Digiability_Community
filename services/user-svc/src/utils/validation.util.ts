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
  role: z.enum(["pwd", "caregiver", "therapist", "ngo", "other"]).optional(),
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
  token: z.string({ required_error: "Reset token is required" }),
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
  role: z.enum(["pwd", "caregiver", "therapist", "ngo", "other"]),
});

// Inferred types
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

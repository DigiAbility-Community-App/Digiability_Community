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
  // Structural check only. The real rules (length, character classes) come
  // from the admin-configured policy and are applied by enforcePasswordPolicy
  // after this schema runs — hardcoding them here too would silently override
  // an admin who relaxes a rule. The 200-char ceiling is just a bcrypt/DoS
  // guard, not a policy value.
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required")
    .max(200, "Password is too long"),
  // Optional server-side: the mobile app requires it, but web register
  // sends no phone. Without this key the validate middleware strips phoneNo
  // from req.body before registerUser can persist it.
  phoneNo: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional(),
  role: z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "other"]).optional(),
  roles: z.array(z.enum(["pwd", "caregiver", "therapist", "ngo", "volunteer", "student", "other"])).optional(),
  // z.literal(true) rather than z.boolean(): a request that omits this field,
  // or sends false, fails validation outright. The gate is structurally
  // unskippable rather than a runtime check a caller could bypass.
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms of Use and Community Guidelines to continue." }),
  }),
  // The version of docs/legal the client actually showed the user. Compared
  // server-side against the current version so an old app build can't record
  // acceptance of text nobody displayed.
  policyVersion: z.string({ required_error: "policyVersion is required" }),
  // Required: Digiability is an 18+ platform (DPDP §9). The eligibility rule
  // itself lives in age.util and is applied in registerUser — this only
  // guarantees a parseable date arrives, so the schema and the gate can't
  // drift apart. Accepts YYYY-MM-DD.
  dateOfBirth: z
    .string({ required_error: "Date of birth is required" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
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
  // See RegisterSchema above — rules live in the admin password policy.
  password: z
    .string({ required_error: "New password is required" })
    .min(1, "New password is required")
    .max(200, "Password is too long"),
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

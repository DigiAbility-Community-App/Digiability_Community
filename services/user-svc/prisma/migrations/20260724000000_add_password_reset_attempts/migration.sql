-- Password reset switched from a long link-token to a 6-digit OTP (mirroring
-- email verification). Add a per-token failed-attempt counter for brute-force
-- protection, matching email_verification_tokens.attempts.
-- IF NOT EXISTS keeps this safe on databases that already got the column via
-- `prisma db push`.
ALTER TABLE "password_reset_tokens" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

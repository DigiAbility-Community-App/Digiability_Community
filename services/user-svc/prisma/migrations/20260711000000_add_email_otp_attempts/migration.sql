-- email_verification_tokens.attempts exists in schema.prisma (added 2026-06-26,
-- commit b60245e) but was never captured in a migration, so databases provisioned
-- from migration history alone are missing it and every OTP operation fails.
-- IF NOT EXISTS keeps this safe on databases that already got the column via
-- `prisma db push`.
ALTER TABLE "email_verification_tokens" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

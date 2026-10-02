-- users.dateOfBirth, users.deletedAt and users.suspensionReason are declared in
-- schema.prisma and selected by loginUser(), but no migration ever created
-- them — they only existed on databases synced with `prisma db push`. On a
-- database built by `prisma migrate deploy` every login query fails with
-- P2022 (column does not exist) and the endpoint returns 500, even for an
-- unknown email.
-- IF NOT EXISTS keeps this safe on databases that already got the columns via
-- `prisma db push`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

CREATE INDEX IF NOT EXISTS "users_deletedAt_idx" ON "users"("deletedAt");

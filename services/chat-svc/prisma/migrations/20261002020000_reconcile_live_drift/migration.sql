-- reports.referenceCode / severity / acknowledgedAt / actionedAt are declared
-- in schema.prisma but no migration added them — they only existed on
-- databases synced with `prisma db push`. Live (built by `migrate deploy`)
-- lacked them, so filing or reading chat reports failed there.
-- IF NOT EXISTS keeps this safe on databases that already got the columns via
-- `prisma db push`. Existing rows get severity 'MEDIUM' from the default.
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "referenceCode" TEXT;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "severity" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3);
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "actionedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "reports_referenceCode_key" ON "reports"("referenceCode");

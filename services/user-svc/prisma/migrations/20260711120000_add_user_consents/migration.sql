-- Adds the user_consents table + ConsentType enum (DPDP consent tracking).
-- Present in schema.prisma but never captured in a migration, so a database
-- provisioned via `migrate deploy` lacks it. Once the privacy code is live,
-- recordRegistrationConsents() runs on every registration and the
-- /api/auth/privacy/consent and /export routes read it — all of which fail
-- without this table. Idempotent so it is safe on databases that already
-- received it via `prisma db push`.

DO $$ BEGIN
  CREATE TYPE "ConsentType" AS ENUM ('DATA_PROCESSING', 'PUSH_NOTIFICATIONS', 'MARKETING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "user_consents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "version" TEXT NOT NULL,
    "ipAddress" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_consents_userId_consentType_key" ON "user_consents"("userId", "consentType");
CREATE INDEX IF NOT EXISTS "user_consents_userId_idx" ON "user_consents"("userId");

DO $$ BEGIN
  ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

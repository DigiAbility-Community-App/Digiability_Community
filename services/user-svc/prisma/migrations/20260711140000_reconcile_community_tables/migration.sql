-- Reconcile the remaining real user-svc tables that exist in schema.prisma but
-- were never captured in a migration: events, mentor profiles/reviews, device
-- tokens (push), and user reports. These already exist on the current live DB
-- (created by an earlier `db push`), so on live this migration is a no-op; on a
-- fresh `migrate deploy` database it creates them. Idempotent throughout.

-- ── Report enums ─────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "ReportTargetType" AS ENUM ('USER', 'MESSAGE', 'GROUP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'MISINFORMATION', 'IMPERSONATION', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "image" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "spots" INTEGER NOT NULL DEFAULT 50,
    "buttonType" TEXT NOT NULL DEFAULT 'filled',
    "externalUrl" TEXT NOT NULL,
    "organizer" TEXT NOT NULL DEFAULT 'DigiAbility Admin',
    "accessibility_tags" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- ── mentor_profiles ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mentor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[],
    "disabilitySpecialties" TEXT[],
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mentor_profiles_userId_key" ON "mentor_profiles"("userId");
CREATE INDEX IF NOT EXISTS "mentor_profiles_isAvailable_idx" ON "mentor_profiles"("isAvailable");

-- ── mentor_reviews ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "mentor_reviews" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mentor_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mentor_reviews_mentorId_idx" ON "mentor_reviews"("mentorId");
CREATE UNIQUE INDEX IF NOT EXISTS "mentor_reviews_mentorId_reviewerId_key" ON "mentor_reviews"("mentorId", "reviewerId");

-- ── device_tokens ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "device_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "device_tokens_token_key" ON "device_tokens"("token");
CREATE INDEX IF NOT EXISTS "device_tokens_userId_idx" ON "device_tokens"("userId");

-- ── user_reports ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_reports_status_createdAt_idx" ON "user_reports"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "user_reports_targetType_targetId_idx" ON "user_reports"("targetType", "targetId");
CREATE UNIQUE INDEX IF NOT EXISTS "user_reports_reporterId_targetType_targetId_key" ON "user_reports"("reporterId", "targetType", "targetId");

-- ── Foreign keys (guarded — added only if absent) ────────────
DO $$ BEGIN ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentor_reviews" ADD CONSTRAINT "mentor_reviews_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "mentor_reviews" ADD CONSTRAINT "mentor_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Reconcile real (non-stub) user-svc tables added on the privacy/moderation
-- branch that were never captured in a migration: master data, admin
-- notification config, moderation keywords/flags, and the admin audit log.
-- A `migrate deploy` database is missing these; some exist on the current
-- live DB via an earlier `db push`. Every statement is idempotent (guarded
-- CREATE TYPE, CREATE TABLE/INDEX IF NOT EXISTS) so it is safe either way.
--
-- The forum_* tables in this service's schema.prisma are inert stub mirrors
-- owned by forum-svc and are intentionally NOT created here.

-- ── Moderation enums ─────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "KeywordSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "KeywordAction" AS ENUM ('flag', 'block'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "KeywordCategory" AS ENUM ('PROFANITY', 'HATE_SPEECH', 'HARASSMENT', 'SPAM', 'SELF_HARM', 'MISINFORMATION', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "KeywordMatchType" AS ENUM ('EXACT', 'CONTAINS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FlagStatus" AS ENUM ('PENDING', 'REVIEWED', 'ACTIONED', 'DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── disability_types (master data) ───────────────────────────
CREATE TABLE IF NOT EXISTS "disability_types" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disability_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "disability_types_code_key" ON "disability_types"("code");

-- ── admin_notification_logs ──────────────────────────────────
CREATE TABLE IF NOT EXISTS "admin_notification_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_notification_logs_pkey" PRIMARY KEY ("id")
);

-- ── admin_notification_settings ──────────────────────────────
CREATE TABLE IF NOT EXISTS "admin_notification_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "email_new_users" BOOLEAN DEFAULT true,
    "email_content_reports" BOOLEAN DEFAULT true,
    "email_failed_transactions" BOOLEAN DEFAULT true,
    "email_system_errors" BOOLEAN DEFAULT true,
    "email_weekly_digest" BOOLEAN DEFAULT true,
    "push_enabled" BOOLEAN DEFAULT true,
    "push_moderation_queue" BOOLEAN DEFAULT true,
    "push_user_milestones" BOOLEAN DEFAULT true,
    "push_community_highlights" BOOLEAN DEFAULT true,
    "push_system_maintenance" BOOLEAN DEFAULT true,
    "sms_critical_only" BOOLEAN DEFAULT true,
    "sms_daily_summary" BOOLEAN DEFAULT true,
    "sms_promotional" BOOLEAN DEFAULT false,
    "phone_number" TEXT DEFAULT '',
    "frequency" TEXT DEFAULT 'Real-time',
    "quiet_start" TEXT DEFAULT '20:00',
    "quiet_end" TEXT DEFAULT '08:00',
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_notification_settings_pkey" PRIMARY KEY ("id")
);

-- ── banned_keywords ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "banned_keywords" (
    "id" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "severity" "KeywordSeverity" NOT NULL DEFAULT 'MEDIUM',
    "action" "KeywordAction" NOT NULL DEFAULT 'block',
    "category" "KeywordCategory" NOT NULL DEFAULT 'OTHER',
    "matchType" "KeywordMatchType" NOT NULL DEFAULT 'CONTAINS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "banned_keywords_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "banned_keywords_phrase_key" ON "banned_keywords"("phrase");
CREATE INDEX IF NOT EXISTS "banned_keywords_isActive_idx" ON "banned_keywords"("isActive");
CREATE INDEX IF NOT EXISTS "banned_keywords_category_idx" ON "banned_keywords"("category");

-- ── moderation_flags ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "moderation_flags" (
    "id" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT,
    "provider" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "categories" TEXT[],
    "status" "FlagStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "moderation_flags_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "moderation_flags_status_createdAt_idx" ON "moderation_flags"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "moderation_flags_userId_idx" ON "moderation_flags"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "moderation_flags_contentType_contentId_key" ON "moderation_flags"("contentType", "contentId");

-- ── admin_audit_log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "admin_audit_log_adminEmail_idx" ON "admin_audit_log"("adminEmail");
CREATE INDEX IF NOT EXISTS "admin_audit_log_targetType_createdAt_idx" ON "admin_audit_log"("targetType", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "admin_audit_log_createdAt_idx" ON "admin_audit_log"("createdAt" DESC);

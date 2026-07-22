-- Reconcile real (non-stub) user-svc objects that exist in schema.prisma but
-- were never captured in a migration: login-lockout and refresh-token-family
-- columns, moderation enums/tables, admin notification config, master data,
-- and the admin audit log.
--
-- Written against the ACTUAL live schema, which is a hybrid: migrations were
-- applied AND `prisma db push` was run at various points, so a table may be
-- absent, correct, OR present with an older, different shape. Guarding only
-- with CREATE TABLE IF NOT EXISTS is therefore not enough — an existing
-- old-shape table is silently skipped and the follow-up CREATE INDEX then
-- fails on a column that does not exist. Each block below detects the real
-- shape before acting, and every statement is idempotent.
--
-- The forum_* tables in this service's schema.prisma are inert stub mirrors
-- owned by forum-svc and are intentionally NOT touched here.

-- ── users: login lockout ─────────────────────────────────────
-- In schema.prisma but in no migration, so absent from any migrate-built
-- database. The auth code selects these, so without them login/register 500.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginAttempts" INTEGER NOT NULL DEFAULT 0;

-- ── refresh_tokens: token family (rotation/reuse detection) ──
ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "familyId" TEXT NOT NULL DEFAULT (gen_random_uuid())::text;
CREATE INDEX IF NOT EXISTS "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

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
-- May exist from an older push with a non-uuid "id". It is a log table and is
-- empty on the live database, so reshape by dropping and recreating.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name  = 'admin_notification_logs'
       AND column_name = 'id'
       AND data_type  <> 'uuid'
  ) THEN
    DROP TABLE "admin_notification_logs";
  END IF;
END $$;

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
-- Exists on the live database from an older push with a different design
-- ("message"/"userId", non-TEXT id). This is what broke the first version of
-- this migration: CREATE TABLE IF NOT EXISTS skipped the old table, then
-- CREATE INDEX on "adminEmail" failed because that column did not exist.
-- The table is empty on live, so reshape by dropping and recreating.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name  = 'admin_audit_log'
       AND column_name = 'message'      -- only the superseded design has this
  ) THEN
    DROP TABLE "admin_audit_log";
  END IF;
END $$;

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

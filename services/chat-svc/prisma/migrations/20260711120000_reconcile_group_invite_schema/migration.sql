-- Reconcile chat-schema drift.
--
-- The single init migration (20260426091650_init_chat) predates Groups,
-- Care Circles, group permission settings, and invites. Those were added to
-- schema.prisma later and only ever reached dev via `prisma db push`, so any
-- database provisioned through `prisma migrate deploy` is missing them and
-- every conversation insert (even a DM — Prisma RETURNs the new columns) 500s.
-- This migration adds exactly that delta. Every statement is idempotent so it
-- is safe to run against a database that already received part of it via push.
--
-- Prerequisite: the init migration must be marked applied in _prisma_migrations.
-- If this database was bootstrapped with `db push` (no migration history),
-- baseline it once with:
--   npx prisma migrate resolve --applied 20260426091650_init_chat

-- ── New enums ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "GroupSubType" AS ENUM ('GENERAL', 'CARE_CIRCLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED', 'AWAITING_APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Care Circle member roles. ADD VALUE IF NOT EXISTS is idempotent; PostgreSQL
-- 16 permits it inside the migration transaction because the new values are
-- not referenced within this same migration.
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'CAREGIVER';
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'MENTOR';
ALTER TYPE "MemberRole" ADD VALUE IF NOT EXISTS 'PROFESSIONAL';

-- ── conversations: group / care-circle / permission columns ──
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "subType" "GroupSubType";
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "maxMembers" INTEGER NOT NULL DEFAULT 256;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "editGroupInfo" TEXT NOT NULL DEFAULT 'ADMINS_ONLY';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "addMembers" TEXT NOT NULL DEFAULT 'ADMINS_ONLY';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "sendMessages" TEXT NOT NULL DEFAULT 'ALL_MEMBERS';
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "approveNewMembers" BOOLEAN NOT NULL DEFAULT false;

-- Backfill subType for any group rows that predate the column.
UPDATE "conversations" SET "subType" = 'GENERAL' WHERE "type" = 'GROUP' AND "subType" IS NULL;

CREATE INDEX IF NOT EXISTS "conversations_subType_idx" ON "conversations"("subType");

-- ── group_invites ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "group_invites" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "message" TEXT,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "group_invites_inviteeId_status_idx" ON "group_invites"("inviteeId", "status");
CREATE INDEX IF NOT EXISTS "group_invites_conversationId_status_idx" ON "group_invites"("conversationId", "status");
CREATE INDEX IF NOT EXISTS "group_invites_conversationId_inviteeId_idx" ON "group_invites"("conversationId", "inviteeId");

DO $$ BEGIN
  ALTER TABLE "group_invites" ADD CONSTRAINT "group_invites_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── hidden_messages ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "hidden_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hidden_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "hidden_messages_userId_idx" ON "hidden_messages"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "hidden_messages_userId_messageId_key" ON "hidden_messages"("userId", "messageId");

-- ── blocked_users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "blocked_users" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "blocked_users_blockerId_idx" ON "blocked_users"("blockerId");
CREATE INDEX IF NOT EXISTS "blocked_users_blockedId_idx" ON "blocked_users"("blockedId");
CREATE UNIQUE INDEX IF NOT EXISTS "blocked_users_blockerId_blockedId_key" ON "blocked_users"("blockerId", "blockedId");

-- ── reports ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "messageContent" TEXT,
    "messageSequence" BIGINT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "reports_status_createdAt_idx" ON "reports"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "reports_reportedUserId_idx" ON "reports"("reportedUserId");

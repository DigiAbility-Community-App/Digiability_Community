-- Group suspension state for conversations.
--
-- Before this migration, "suspending" a group was implemented by the admin
-- panel as `sendMessages = 'ADMINS_ONLY'`, and suspended-ness was read back
-- as the derived expression `(sendMessages = 'ADMINS_ONLY')`. That conflated
-- an owner-facing permission with a platform-admin enforcement action:
--   * group admins could still post in a "suspended" group (ADMINS_ONLY
--     permits OWNER/ADMIN/CAREGIVER by design), and
--   * editing group permissions silently cleared the suspension.
--
-- Suspension now has its own state. `suspendedUntil IS NULL` while
-- `isSuspended` is true means an indefinite suspension.

ALTER TABLE "chat"."conversations"
  ADD COLUMN "isSuspended"      BOOLEAN NOT NULL DEFAULT false,
  -- timestamptz on purpose: these are written by the admin panel via node-pg
  -- and read by chat-svc via Prisma. With a naked `timestamp without time
  -- zone` those two disagree by the host's UTC offset (node-pg writes a local
  -- literal, Prisma reads it as UTC), which silently stretches or shortens
  -- every timed suspension. An absolute instant removes the ambiguity.
  ADD COLUMN "suspendedAt"      TIMESTAMPTZ(3),
  ADD COLUMN "suspendedUntil"   TIMESTAMPTZ(3),
  ADD COLUMN "suspensionReason" TEXT,
  ADD COLUMN "suspensionNote"   TEXT;

CREATE INDEX "conversations_isSuspended_idx"
  ON "chat"."conversations"("isSuspended");

-- NOTE: intentionally no data backfill from `sendMessages = 'ADMINS_ONLY'`.
-- That value is a legitimate announcement-only group configuration and is
-- indistinguishable from a genuine suspension, so backfilling would suspend
-- every announcement group on the platform. Existing suspensions must be
-- re-applied by an admin; the audit log records which groups were affected.

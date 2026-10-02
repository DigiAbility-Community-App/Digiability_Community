-- ─────────────────────────────────────────────────────────────
-- Rewrite absolute forum media URLs to host-relative paths.
--
-- forum-svc used to store uploads as `${req.protocol}://${host}/uploads/x`.
-- Behind the TLS ingress (no `trust proxy`) that produced
-- "http://<node-ip>:30503/uploads/x", which production apps can't load,
-- save or share (cleartext is denied). forum-svc now stores "/uploads/x"
-- and each client resolves it against its own forum base URL.
--
-- Safe to run more than once: only rows that still hold an absolute URL to
-- an /uploads/ path are touched; a second run updates 0 rows. URLs that
-- don't point at our /uploads/ (none expected) are left as they are.
--
-- Run (prod: DevOps, see DEVOPS_TASKS.txt):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 2026-10-media-urls-relative.sql
-- ─────────────────────────────────────────────────────────────

BEGIN;

\echo 'Absolute /uploads/ URLs before:'
SELECT 'forum_questions.imageUrl' AS col, COUNT(*) FROM forum_questions WHERE "imageUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_questions.audioUrl', COUNT(*) FROM forum_questions WHERE "audioUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_answers.imageUrl',   COUNT(*) FROM forum_answers   WHERE "imageUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_answers.audioUrl',   COUNT(*) FROM forum_answers   WHERE "audioUrl" ~ '^https?://[^/]+/uploads/';

UPDATE forum_questions
   SET "imageUrl" = regexp_replace("imageUrl", '^https?://[^/]+(/uploads/.+)$', '\1')
 WHERE "imageUrl" ~ '^https?://[^/]+/uploads/';

UPDATE forum_questions
   SET "audioUrl" = regexp_replace("audioUrl", '^https?://[^/]+(/uploads/.+)$', '\1')
 WHERE "audioUrl" ~ '^https?://[^/]+/uploads/';

UPDATE forum_answers
   SET "imageUrl" = regexp_replace("imageUrl", '^https?://[^/]+(/uploads/.+)$', '\1')
 WHERE "imageUrl" ~ '^https?://[^/]+/uploads/';

UPDATE forum_answers
   SET "audioUrl" = regexp_replace("audioUrl", '^https?://[^/]+(/uploads/.+)$', '\1')
 WHERE "audioUrl" ~ '^https?://[^/]+/uploads/';

\echo 'Absolute /uploads/ URLs after (all should be 0):'
SELECT 'forum_questions.imageUrl' AS col, COUNT(*) FROM forum_questions WHERE "imageUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_questions.audioUrl', COUNT(*) FROM forum_questions WHERE "audioUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_answers.imageUrl',   COUNT(*) FROM forum_answers   WHERE "imageUrl" ~ '^https?://[^/]+/uploads/'
UNION ALL SELECT 'forum_answers.audioUrl',   COUNT(*) FROM forum_answers   WHERE "audioUrl" ~ '^https?://[^/]+/uploads/';

COMMIT;

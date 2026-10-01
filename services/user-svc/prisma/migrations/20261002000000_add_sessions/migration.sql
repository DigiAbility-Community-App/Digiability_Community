-- VAPT M-003 / CWE-613: server-side sessions.
--
-- Every access token now carries a `sid` claim naming a row in `sessions`;
-- revoking that row invalidates the token on its next request in every
-- service. refresh_tokens stays as the rotation history used for reuse
-- detection and gains a sessionId.
--
-- Additive only. Existing logins are carried over (backfill below), so no user
-- is logged out by this migration — their next refresh lands on the session
-- created here.

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_refreshTokenHash_idx" ON "sessions"("refreshTokenHash");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "sessionId" TEXT;

-- Backfill: one session per refresh-token family that still has a live token.
-- The family id becomes the session id; the newest live token is the current one.
INSERT INTO "sessions" ("id", "userId", "refreshTokenHash", "createdAt", "lastUsedAt", "expiresAt")
SELECT DISTINCT ON (rt."familyId")
       rt."familyId",
       rt."userId",
       rt."tokenHash",
       fam."firstCreatedAt",
       rt."createdAt",
       rt."expiresAt"
FROM "refresh_tokens" rt
JOIN (
    SELECT "familyId", MIN("createdAt") AS "firstCreatedAt"
    FROM "refresh_tokens"
    GROUP BY "familyId"
) fam ON fam."familyId" = rt."familyId"
WHERE rt."revoked" = false
  AND rt."expiresAt" > CURRENT_TIMESTAMP
ORDER BY rt."familyId", rt."createdAt" DESC;

UPDATE "refresh_tokens" rt
SET "sessionId" = rt."familyId"
WHERE EXISTS (SELECT 1 FROM "sessions" s WHERE s."id" = rt."familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_sessionId_idx" ON "refresh_tokens"("sessionId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

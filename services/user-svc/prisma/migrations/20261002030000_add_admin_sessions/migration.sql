-- Server-side admin panel sessions (apps/admin lib/adminSessions.server.ts).
-- Every admin token carries a `sid` naming a row here; logout and "sign out of
-- all devices" revoke the row, which ends the session wherever the token is.
-- The admin also creates this table at runtime with the same shape, so
-- IF NOT EXISTS keeps this a no-op wherever that already happened.
CREATE TABLE IF NOT EXISTS "admin_sessions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" VARCHAR(255),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" TEXT,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_sessions_email_idx" ON "admin_sessions"("email");

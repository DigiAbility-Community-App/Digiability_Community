// ─────────────────────────────────────────────────────
// Retention Worker — DPDP Act 2023 §8(7)
//
// Runs once at startup and then on a daily schedule to
// purge rows that exceed the retention periods defined
// in retention.config.ts. All deletions are best-effort
// and do not affect service availability.
//
// This worker runs inside the user-svc process — no
// separate container or queue needed.
// ─────────────────────────────────────────────────────

import prisma from "../models/prisma.client";
import { RETENTION_DAYS } from "../config/retention.config";
import { retryPendingErasures } from "../services/erasure.service";
import { raiseAlert } from "../services/alert.service";

const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

async function runRetentionPass(): Promise<void> {
  const startedAt = new Date().toISOString();
  const results: Record<string, number> = {};

  try {
    // 1. Expired email-verification tokens
    const evtResult = await prisma.emailVerificationToken.deleteMany({
      where: { expiresAt: { lt: daysAgo(RETENTION_DAYS.emailVerificationTokens) } },
    });
    results.emailVerificationTokens = evtResult.count;

    // 2. Expired password-reset tokens
    const prtResult = await prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: daysAgo(RETENTION_DAYS.passwordResetTokens) } },
    });
    results.passwordResetTokens = prtResult.count;

    // 3. Old revoked refresh tokens (not all — only those past the retention window)
    const rrtResult = await prisma.refreshToken.deleteMany({
      where: {
        revoked: true,
        createdAt: { lt: daysAgo(RETENTION_DAYS.revokedRefreshTokens) },
      },
    });
    results.revokedRefreshTokens = rrtResult.count;

    // 4. Admin audit log entries older than the retention window
    const aalResult = await prisma.adminAuditLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION_DAYS.adminAuditLog) } },
    });
    results.adminAuditLog = aalResult.count;

    // 5. Old moderation flags (DISMISSED flags only — active flags kept for appeal window)
    const mfResult = await prisma.moderationFlag.deleteMany({
      where: {
        status: "DISMISSED",
        createdAt: { lt: daysAgo(RETENTION_DAYS.moderationFlags) },
      },
    });
    results.moderationFlags = mfResult.count;

    // 6. Old user reports (DISMISSED and ACTIONED only)
    const urResult = await prisma.userReport.deleteMany({
      where: {
        status: { in: ["DISMISSED", "ACTIONED"] },
        createdAt: { lt: daysAgo(RETENTION_DAYS.userReports) },
      },
    });
    results.userReports = urResult.count;

    // 7. Sealed registration records past their 180-day statutory window.
    //    This is the last trace of a deleted account; once it goes, nothing
    //    identifying that user remains anywhere in user-svc.
    const rrResult = await prisma.registrationRecord.deleteMany({
      where: { purgeAfter: { lt: new Date() } },
    });
    results.registrationRecords = rrResult.count;

    // 8. Snapshots of removed content past their 180-day preservation window.
    const rcResult = await prisma.removedContentRecord.deleteMany({
      where: { purgeAfter: { lt: new Date() } },
    });
    results.removedContentRecords = rcResult.count;

    // 9. Retry cross-service erasure that never confirmed. A deleted user's
    //    chat or forum content still being intact is an outstanding erasure
    //    obligation, not a transient blip, so it is retried rather than lost.
    results.erasuresRepaired = await retryPendingErasures();

    const totalDeleted = Object.values(results).reduce((s, v) => s + v, 0);
    if (totalDeleted > 0) {
      process.stdout.write(
        JSON.stringify({
          event: "retention.pass_completed",
          startedAt,
          completedAt: new Date().toISOString(),
          deleted: results,
        }) + "\n"
      );
    }
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        event: "retention.pass_failed",
        startedAt,
        error: (err as Error).message,
      }) + "\n"
    );

    // Every published retention period depends on this job. If it stops
    // running, we breach all of them quietly — so this is worth waking
    // someone for rather than leaving in a log nobody reads.
    await raiseAlert({
      severity: "critical",
      title: "Data retention pass failed",
      detail:
        "The daily retention job did not complete. Until it runs successfully, data " +
        "past its retention period is not being deleted, including the 180-day " +
        "registration and removed-content records.",
      context: { startedAt, error: (err as Error).message },
    });
  }
}

export async function startRetentionWorker(): Promise<void> {
  // Run once on startup to catch up after a service restart
  await runRetentionPass();

  // Then schedule daily runs
  setInterval(() => {
    runRetentionPass();
  }, RUN_INTERVAL_MS);

  process.stdout.write(
    JSON.stringify({
      event: "retention.worker_started",
      intervalHours: RUN_INTERVAL_MS / (60 * 60 * 1000),
      timestamp: new Date().toISOString(),
    }) + "\n"
  );
}

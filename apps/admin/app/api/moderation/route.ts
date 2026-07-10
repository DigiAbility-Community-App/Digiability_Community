import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import crypto from "crypto";

// Allowlist mapping from the UI's ban durations to safe SQL intervals.
function durationToInterval(duration: string): string | null {
  const map: Record<string, string> = {
    "7 Days": "7 days",
    "30 Days": "30 days",
    "90 Days": "90 days",
  };
  return map[duration] ?? null; // null → permanent
}

// Suspend a user. `users` is the source of truth read by user-svc's
// login/auth gate; forum_user_stats is kept in sync for forum-svc's own
// (forum-scoped) posting checks.
async function suspendUser(userId: string, interval: string | null, reason?: string | null) {
  const uuid = crypto.randomUUID();
  if (interval === null) {
    await dbPool.query(
      `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NULL, "suspensionReason" = $2 WHERE id = $1`,
      [userId, reason ?? null]
    );
    await dbPool.query(
      `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
       VALUES ($1, $2, true, NULL)
       ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NULL`,
      [uuid, userId]
    );
  } else {
    await dbPool.query(
      `UPDATE users SET "isSuspended" = true, "suspendedUntil" = NOW() + ($2::interval), "suspensionReason" = $3 WHERE id = $1`,
      [userId, interval, reason ?? null]
    );
    await dbPool.query(
      `INSERT INTO forum_user_stats (id, "userId", "isSuspended", "suspendedUntil")
       VALUES ($1, $2, true, NOW() + ($3::interval))
       ON CONFLICT ("userId") DO UPDATE SET "isSuspended" = true, "suspendedUntil" = NOW() + ($3::interval)`,
      [uuid, userId, interval]
    );
  }
}

async function notifyUser(userId: string, type: string, title: string, message: string) {
  await dbPool.query(
    `INSERT INTO forum_notifications (id, "userId", type, title, message, read, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, NOW())`,
    [userId, type, title, message]
  );
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const [reportsResult, suspendedResult, statsResult] = await Promise.all([
      dbPool.query(`
        SELECT
          fr.id,
          fr.reason,
          fr."createdAt",
          fr."questionId",
          fr."answerId",
          reporter.name as "reporterName",
          reporter.email as "reporterEmail",
          fq.title as "questionTitle",
          fa.content as "answerContent",
          COALESCE(qauthor.id, aauthor.id) as "authorId",
          COALESCE(qauthor.name, aauthor.name) as "authorName",
          COALESCE(qauthor.email, aauthor.email) as "authorEmail"
        FROM forum_reports fr
        JOIN users reporter ON fr."reporterId" = reporter.id
        LEFT JOIN forum_questions fq ON fr."questionId" = fq.id
        LEFT JOIN forum_answers fa ON fr."answerId" = fa.id
        LEFT JOIN users qauthor ON fq."authorId" = qauthor.id
        LEFT JOIN users aauthor ON fa."authorId" = aauthor.id
        ORDER BY fr."createdAt" DESC
        LIMIT 100
      `),
      dbPool.query(`
        SELECT
          u.id,
          u."isSuspended",
          u."suspendedUntil",
          u."suspensionReason",
          u.name,
          u.email,
          u.id as "userId"
        FROM users u
        WHERE u."isSuspended" = true
      `),
      dbPool.query(`
        SELECT
          (SELECT COUNT(*) FROM forum_reports) as "totalReports",
          (SELECT COUNT(*) FROM forum_questions WHERE "deletedAt" IS NOT NULL) as "deletedPosts",
          (SELECT COUNT(*) FROM users WHERE "isSuspended" = true) as "suspendedUsers",
          (SELECT COUNT(*) FROM forum_reports WHERE "createdAt" >= NOW() - INTERVAL '24 hours') as "reportsToday"
        FROM (SELECT 1) as t
      `),
    ]);

    // Chat/DM reports (from chat-svc's reports table). Guarded because the
    // table only exists after `prisma db push` on chat-svc.
    let chatReportRows: any[] = [];
    try {
      const chatResult = await dbPool.query(`
        SELECT
          r.id,
          r.reason,
          r."createdAt",
          r."reportedUserId",
          r."messageId",
          r."conversationId",
          r."messageContent",
          r."messageSequence",
          reporter.name as "reporterName",
          reporter.email as "reporterEmail",
          reported.name as "authorName",
          reported.email as "authorEmail"
        FROM chat.reports r
        LEFT JOIN users reporter ON r."reporterId" = reporter.id
        LEFT JOIN users reported ON r."reportedUserId" = reported.id
        WHERE r.status = 'OPEN'
        ORDER BY r."createdAt" DESC
        LIMIT 100
      `);
      chatReportRows = chatResult.rows;
    } catch {
      // reports table not migrated yet — treat as no chat reports.
      chatReportRows = [];
    }

    const fmtDate = (d: any) =>
      new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const forumReports = reportsResult.rows.map((r) => ({
      ...r,
      _ts: new Date(r.createdAt).getTime(),
      createdAt: fmtDate(r.createdAt),
      type: r.questionId ? "question" : "answer",
      source: "forum" as const,
    }));

    const chatReports = chatReportRows.map((r) => ({
      id: r.id,
      reason: r.reason,
      _ts: new Date(r.createdAt).getTime(),
      createdAt: fmtDate(r.createdAt),
      questionId: null,
      answerId: null,
      questionTitle: null,
      answerContent: r.messageContent || "Reported chat message (content unavailable)",
      reporterName: r.reporterName || "Unknown",
      reporterEmail: r.reporterEmail || "",
      authorId: r.reportedUserId,
      authorName: r.authorName || "Unknown",
      authorEmail: r.authorEmail || "",
      messageId: r.messageId,
      conversationId: r.conversationId,
      messageSequence: r.messageSequence ? String(r.messageSequence) : null,
      type: "chat" as const,
      source: "chat" as const,
    }));

    const allReports = [...forumReports, ...chatReports]
      .sort((a, b) => b._ts - a._ts)
      .map(({ _ts, ...rest }) => rest);

    const baseStats = statsResult.rows[0];
    const stats = {
      ...baseStats,
      totalReports: String(Number(baseStats.totalReports) + chatReports.length),
    };

    return NextResponse.json({
      success: true,
      reports: allReports,
      suspendedUsers: suspendedResult.rows,
      stats,
    });
  } catch (error) {
    console.error("Failed to fetch moderation data:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action, reportId, questionId, userId, category, message, reason, duration } = body;

    if (action === "dismiss" && reportId) {
      await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [reportId]);
      await writeAudit({ action: "report_dismiss", reason: `forum report ${reportId}` });
    } else if (action === "dismiss_chat" && reportId) {
      await dbPool.query(`UPDATE chat.reports SET status = 'DISMISSED' WHERE id = $1`, [reportId]);
      await writeAudit({ action: "report_dismiss", reason: `chat report ${reportId}` });
    } else if (action === "delete_post" && questionId) {
      await dbPool.query(
        `UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`,
        [questionId]
      );
      await dbPool.query(`DELETE FROM forum_reports WHERE "questionId" = $1`, [
        questionId,
      ]);
      await writeAudit({ action: "delete_post", reason: `question ${questionId}` });
    } else if (action === "unsuspend" && userId) {
      await dbPool.query(
        `UPDATE users SET "isSuspended" = false, "suspendedUntil" = NULL, "suspensionReason" = NULL WHERE id = $1`,
        [userId]
      );
      await dbPool.query(
        `UPDATE forum_user_stats SET "isSuspended" = false, "suspendedUntil" = NULL WHERE "userId" = $1`,
        [userId]
      );
      await writeAudit({ userId, action: "unsuspend" });
    } else if (action === "warn" && userId) {
      // Notify the offending user; optionally trigger a 7-day suspension.
      const title = `Warning: ${category || "Community Guidelines"}`;
      const warnMessage = message || "Your content was flagged for violating community guidelines.";
      await notifyUser(userId, "MODERATION_WARNING", title, warnMessage);
      if (body.triggerSuspend) {
        await suspendUser(userId, "7 days", warnMessage);
      }
      await writeAudit({ userId, action: "warn", reason: category, message });
    } else if (action === "ban" && userId) {
      // Suspend the offending user (permanent unless a duration is given).
      const interval = duration ? durationToInterval(duration) : null;
      const banMessage = message || reason || "Your account has been suspended for violating community guidelines.";
      await suspendUser(userId, interval, banMessage);
      await notifyUser(userId, "MODERATION_BAN", "Your account has been suspended", banMessage);
      await writeAudit({ userId, action: "ban", reason, message });
    } else {
      return NextResponse.json(
        { success: false, message: "Invalid or incomplete moderation action" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to perform moderation action:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import crypto from "crypto";

// ─────────────────────────────────────────────────────
// Unified Review Queue API
// Reads directly from PostgreSQL (forum_reports + chat.reports + moderation_flags)
// ─────────────────────────────────────────────────────

async function ensureTables() {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS moderation_history (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      report_id TEXT,
      source TEXT NOT NULL,
      content_type TEXT,
      content_preview TEXT,
      reason TEXT,
      author_id TEXT,
      author_name TEXT,
      reporter_id TEXT,
      reporter_name TEXT,
      action_taken TEXT NOT NULL,
      admin_notes TEXT,
      resolved_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

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

  try {
    await dbPool.query(
      `UPDATE chat.conversation_members SET "leftAt" = NOW() WHERE "userId" = $1 AND "leftAt" IS NULL`,
      [userId]
    );
  } catch {}
}

async function notifyUser(userId: string, type: string, title: string, message: string) {
  await dbPool.query(
    `INSERT INTO forum_notifications (id, "userId", type, title, message, read, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, NOW())`,
    [userId, type, title, message]
  );
}

async function recordHistory(entry: {
  reportId?: string | null;
  source: string;
  contentType?: string | null;
  contentPreview?: string | null;
  reason?: string | null;
  authorId?: string | null;
  authorName?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  actionTaken: string;
  adminNotes?: string | null;
}) {
  await ensureTables();
  await dbPool.query(
    `INSERT INTO moderation_history (
      id, report_id, source, content_type, content_preview, reason,
      author_id, author_name, reporter_id, reporter_name, action_taken, admin_notes, resolved_at
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
    [
      entry.reportId || null,
      entry.source,
      entry.contentType || null,
      entry.contentPreview || null,
      entry.reason || null,
      entry.authorId || null,
      entry.authorName || null,
      entry.reporterId || null,
      entry.reporterName || null,
      entry.actionTaken,
      entry.adminNotes || null,
    ]
  );
}

// ─────────────────────────────────────────────────────
// GET — unified review queue
// ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "PENDING";
  const type = searchParams.get("type") ?? "all"; // all | report | flag | chat | forum

  try {
    await ensureTables();

    // 1. Forum reports query
    let forumRows: any[] = [];
    if (type === "all" || type === "report" || type === "forum") {
      const forumResult = await dbPool.query(`
        SELECT
          fr.id,
          fr.reason,
          fr."createdAt",
          fr."questionId",
          fr."answerId",
          reporter.id as "reporterId",
          reporter.name as "reporterName",
          reporter.email as "reporterEmail",
          fq.title as "questionTitle",
          fq.description as "questionDescription",
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
      `);
      forumRows = forumResult.rows;
    }

    // 2. Chat / DM reports query
    let chatRows: any[] = [];
    if (type === "all" || type === "report" || type === "chat") {
      try {
        const chatStatusClause =
          status === "PENDING"
            ? "WHERE r.status = 'OPEN' OR r.status IS NULL"
            : status === "ACTIONED"
            ? "WHERE r.status = 'ACTIONED'"
            : status === "DISMISSED"
            ? "WHERE r.status = 'DISMISSED'"
            : "";

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
            COALESCE(r.status, 'OPEN') as status,
            reporter.id as "reporterId",
            reporter.name as "reporterName",
            reporter.email as "reporterEmail",
            reported.name as "authorName",
            reported.email as "authorEmail"
          FROM chat.reports r
          LEFT JOIN users reporter ON r."reporterId" = reporter.id
          LEFT JOIN users reported ON r."reportedUserId" = reported.id
          ${chatStatusClause}
          ORDER BY r."createdAt" DESC
          LIMIT 100
        `);
        chatRows = chatResult.rows;
      } catch (err) {
        console.error("Chat reports table query failed:", err);
      }
    }

    // 3. AI Flags query (if exists)
    let flagRows: any[] = [];
    if (type === "all" || type === "flag") {
      try {
        const flagResult = await dbPool.query(`
          SELECT
            id, "contentType", "contentId", "userId", text,
            provider, score, categories, status, "createdAt"
          FROM moderation_flags
          WHERE status = $1 OR $1 = 'ALL'
          ORDER BY "createdAt" DESC
          LIMIT 50
        `, [status]);
        flagRows = flagResult.rows;
      } catch {
        // Table may not exist yet
      }
    }

    // Normalize everything into a single unified queue structure
    const items = [
      ...chatRows.map((r: any) => ({
        id: r.id,
        kind: "chat_report" as const,
        source: "chat" as const,
        contentType: "chat_message",
        contentId: r.messageId || r.id,
        messageId: r.messageId,
        conversationId: r.conversationId,
        messageSequence: r.messageSequence ? String(r.messageSequence) : null,
        userId: r.reportedUserId || "",
        userEmail: r.authorEmail || "",
        userName: r.authorName || "Chat User",
        reporterId: r.reporterId || "",
        reporterEmail: r.reporterEmail || "",
        reporterName: r.reporterName || "Reporter",
        summary: r.reason ? `${r.reason.replace(/_/g, " ")}` : "Reported chat message",
        contentPreview: r.messageContent || "(no content preview)",
        score: null as number | null,
        status: r.status === "OPEN" ? "PENDING" : r.status,
        createdAt: r.createdAt,
      })),
      ...forumRows.map((r: any) => ({
        id: r.id,
        kind: "user_report" as const,
        source: "forum" as const,
        contentType: r.questionId ? "question" : "answer",
        contentId: r.questionId || r.answerId || r.id,
        questionId: r.questionId,
        answerId: r.answerId,
        userId: r.authorId || "",
        userEmail: r.authorEmail || "",
        userName: r.authorName || "Forum Member",
        reporterId: r.reporterId || "",
        reporterEmail: r.reporterEmail || "",
        reporterName: r.reporterName || "Reporter",
        summary: r.reason ? `${r.reason.replace(/_/g, " ")}` : "Reported forum content",
        contentPreview: r.questionTitle || r.questionDescription || r.answerContent || "(no content preview)",
        score: null as number | null,
        status: "PENDING",
        createdAt: r.createdAt,
      })),
      ...flagRows.map((f: any) => ({
        id: f.id,
        kind: "ai_flag" as const,
        source: "ai" as const,
        contentType: f.contentType || "ai_flag",
        contentId: f.contentId || f.id,
        userId: f.userId || "",
        userEmail: "",
        userName: "Flagged User",
        reporterId: "system",
        reporterEmail: "",
        reporterName: `AI (${f.provider || "Guardian"})`,
        summary: Array.isArray(f.categories) ? f.categories.join(", ") : "AI Detected Anomaly",
        contentPreview: f.text?.slice(0, 140) || "(no preview)",
        score: typeof f.score === "number" ? f.score : null,
        status: f.status || "PENDING",
        createdAt: f.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, data: { items, total: items.length } });
  } catch (err) {
    console.error("Failed to load review queue:", err);
    return NextResponse.json({ success: false, message: "Failed to load review queue" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────
// POST — execute a review action
// ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  let body: {
    id: string;
    kind?: string;
    source?: string;
    action: "dismiss" | "remove_content" | "warn_user" | "ban_user";
    contentType?: string;
    contentId?: string;
    messageId?: string;
    questionId?: string;
    answerId?: string;
    userId?: string;
    reason?: string;
    contentPreview?: string;
    authorName?: string;
    reporterName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    id,
    source,
    action,
    contentType,
    contentId,
    messageId,
    questionId,
    answerId,
    userId,
    reason,
    contentPreview,
    authorName,
    reporterName,
  } = body;

  try {
    await ensureTables();

    const isChat = source === "chat" || contentType === "chat_message" || Boolean(messageId);
    const isQuestion = contentType === "question" || Boolean(questionId);
    const isAnswer = contentType === "answer" || Boolean(answerId);

    // ── 1. Action execution ──
    if (action === "dismiss") {
      if (isChat) {
        await dbPool.query(`UPDATE chat.reports SET status = 'DISMISSED' WHERE id = $1 OR "messageId" = $2`, [id, messageId || contentId]);
      } else {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [id]);
      }

      await recordHistory({
        reportId: id,
        source: isChat ? "chat" : "forum",
        contentType: isChat ? "chat_message" : isQuestion ? "question" : "answer",
        contentPreview: contentPreview || "Reviewed content",
        reason: reason || "False positive / dismissed",
        authorId: userId || null,
        authorName: authorName || "Community Member",
        reporterName: reporterName || "Reporter",
        actionTaken: "DISMISSED",
        adminNotes: "Report dismissed by admin review queue.",
      });

      await writeAudit({ action: "report_dismiss", reason: `id ${id}` });
    } else if (action === "remove_content") {
      if (isChat) {
        const msgTarget = messageId || contentId;
        if (msgTarget) {
          try {
            await dbPool.query(
              `UPDATE chat.messages SET status = 'DELETED', "deletedAt" = NOW(), content = '' WHERE id = $1`,
              [msgTarget]
            );
          } catch (msgErr: any) {
            console.error("[review] message DELETED update failed, falling back:", msgErr?.message);
            await dbPool.query(
              `UPDATE chat.messages SET "deletedAt" = NOW(), content = '' WHERE id = $1`,
              [msgTarget]
            );
          }
        }
        await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1 OR "messageId" = $2`, [id, msgTarget]);
      } else if (isQuestion) {
        const qTarget = questionId || contentId;
        if (qTarget) {
          await dbPool.query(`UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`, [qTarget]);
          await dbPool.query(`DELETE FROM forum_reports WHERE "questionId" = $1 OR id = $2`, [qTarget, id]);
        }
      } else if (isAnswer) {
        const aTarget = answerId || contentId;
        if (aTarget) {
          await dbPool.query(`UPDATE forum_answers SET "deletedAt" = NOW() WHERE id = $1`, [aTarget]);
          await dbPool.query(`DELETE FROM forum_reports WHERE "answerId" = $1 OR id = $2`, [aTarget, id]);
        }
      } else {
        // Generic forum report delete
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [id]);
      }

      await recordHistory({
        reportId: id,
        source: isChat ? "chat" : "forum",
        contentType: isChat ? "chat_message" : isQuestion ? "question" : "answer",
        contentPreview: contentPreview || "Offending content",
        reason: reason || "Violation of safety standards",
        authorId: userId || null,
        authorName: authorName || "Author",
        reporterName: reporterName || "Reporter",
        actionTaken: "CONTENT_REMOVED",
        adminNotes: "Content permanently removed by admin.",
      });

      await writeAudit({ action: "content_removed", reason: `id ${id}` });
    } else if (action === "warn_user") {
      if (userId) {
        await suspendUser(userId, "7 days", reason || "7-day warning suspension from review queue");
        await notifyUser(
          userId,
          "WARNING",
          "Account Warning & 7-Day Suspension",
          reason || "Your recent activity violated our community guidelines. Your account is temporarily suspended for 7 days."
        );
      }

      if (isChat) {
        await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1`, [id]);
      } else {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [id]);
      }

      await recordHistory({
        reportId: id,
        source: isChat ? "chat" : "forum",
        contentType: isChat ? "chat_message" : isQuestion ? "question" : "answer",
        contentPreview: contentPreview || "User content",
        reason: reason || "User warning issued",
        authorId: userId || null,
        authorName: authorName || "Offending User",
        reporterName: reporterName || "Reporter",
        actionTaken: "USER_WARNED",
        adminNotes: "User issued 7-day warning suspension.",
      });

      await writeAudit({ action: "warn_user", reason: `user ${userId}` });
    } else if (action === "ban_user") {
      if (userId) {
        await suspendUser(userId, null, reason || "Permanent ban from review queue");
        await notifyUser(
          userId,
          "BANNED",
          "Account Permanently Banned",
          reason || "Your account has been permanently suspended due to severe community guideline violations."
        );
      }

      if (isChat) {
        await dbPool.query(`UPDATE chat.reports SET status = 'ACTIONED' WHERE id = $1`, [id]);
      } else {
        await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [id]);
      }

      await recordHistory({
        reportId: id,
        source: isChat ? "chat" : "forum",
        contentType: isChat ? "chat_message" : isQuestion ? "question" : "answer",
        contentPreview: contentPreview || "User content",
        reason: reason || "Permanent suspension",
        authorId: userId || null,
        authorName: authorName || "Offending User",
        reporterName: reporterName || "Reporter",
        actionTaken: "USER_PERMANENTLY_BANNED",
        adminNotes: "User permanently banned.",
      });

      await writeAudit({ action: "ban_user", reason: `user ${userId}` });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[review] Action execution failed:", err);
    return NextResponse.json({ success: false, message: "Action execution failed" }, { status: 500 });
  }
}

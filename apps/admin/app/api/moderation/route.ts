import { NextResponse } from "next/server";
import { dbPool } from "@/lib/db";

export async function GET() {
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
          fa.content as "answerContent"
        FROM forum_reports fr
        JOIN users reporter ON fr."reporterId" = reporter.id
        LEFT JOIN forum_questions fq ON fr."questionId" = fq.id
        LEFT JOIN forum_answers fa ON fr."answerId" = fa.id
        ORDER BY fr."createdAt" DESC
        LIMIT 100
      `),
      dbPool.query(`
        SELECT
          fus.id,
          fus."isSuspended",
          fus."suspendedUntil",
          u.name,
          u.email,
          u.id as "userId"
        FROM forum_user_stats fus
        JOIN users u ON fus."userId" = u.id
        WHERE fus."isSuspended" = true
      `),
      dbPool.query(`
        SELECT
          (SELECT COUNT(*) FROM forum_reports) as "totalReports",
          (SELECT COUNT(*) FROM forum_questions WHERE "deletedAt" IS NOT NULL) as "deletedPosts",
          (SELECT COUNT(*) FROM forum_user_stats WHERE "isSuspended" = true) as "suspendedUsers",
          (SELECT COUNT(*) FROM forum_reports WHERE "createdAt" >= NOW() - INTERVAL '24 hours') as "reportsToday"
        FROM (SELECT 1) as t
      `),
    ]);

    return NextResponse.json({
      success: true,
      reports: reportsResult.rows.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        type: r.questionId ? "question" : "answer",
      })),
      suspendedUsers: suspendedResult.rows,
      stats: statsResult.rows[0],
    });
  } catch (error) {
    console.error("Failed to fetch moderation data:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { action, reportId, questionId, userId } = await request.json();

    if (action === "dismiss" && reportId) {
      await dbPool.query(`DELETE FROM forum_reports WHERE id = $1`, [reportId]);
    } else if (action === "delete_post" && questionId) {
      await dbPool.query(
        `UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`,
        [questionId]
      );
      await dbPool.query(`DELETE FROM forum_reports WHERE "questionId" = $1`, [
        questionId,
      ]);
    } else if (action === "unsuspend" && userId) {
      await dbPool.query(
        `UPDATE forum_user_stats SET "isSuspended" = false, "suspendedUntil" = NULL WHERE "userId" = $1`,
        [userId]
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

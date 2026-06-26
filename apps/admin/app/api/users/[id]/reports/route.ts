import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const fmt = (row: any) => ({
      id: row.id, reason: row.reason || "Unknown",
      createdAt: new Date(row.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),
      questionId: row.questionId || null, answerId: row.answerId || null,
      questionTitle: row.questionTitle || null,
      answerContent: row.answerContent ? String(row.answerContent).substring(0,120) : null,
      reporterName: row.reporterName || null,
    });

    const [againstRes, submittedRes, suspRes] = await Promise.all([
      dbPool.query(`
        SELECT fr.id,fr.reason,fr."createdAt",fr."questionId",fr."answerId",
               fq.title AS "questionTitle",fa.content AS "answerContent",u.name AS "reporterName"
        FROM forum_reports fr
        LEFT JOIN forum_questions fq ON fr."questionId"=fq.id
        LEFT JOIN forum_answers fa ON fr."answerId"=fa.id
        LEFT JOIN users u ON fr."reporterId"=u.id
        WHERE fq."authorId"=$1 OR fa."authorId"=$1
        ORDER BY fr."createdAt" DESC LIMIT 50
      `, [id]),
      dbPool.query(`
        SELECT fr.id,fr.reason,fr."createdAt",fr."questionId",fr."answerId",
               fq.title AS "questionTitle",fa.content AS "answerContent"
        FROM forum_reports fr
        LEFT JOIN forum_questions fq ON fr."questionId"=fq.id
        LEFT JOIN forum_answers fa ON fr."answerId"=fa.id
        WHERE fr."reporterId"=$1
        ORDER BY fr."createdAt" DESC LIMIT 50
      `, [id]),
      dbPool.query(`
        SELECT "isSuspended","suspendedUntil",reputation
        FROM forum_user_stats WHERE "userId"=$1
      `, [id]),
    ]);

    const susp = suspRes.rows[0] ?? null;
    return NextResponse.json({
      success: true,
      reportsAgainst: againstRes.rows.map(fmt),
      reportsSubmitted: submittedRes.rows.map(fmt),
      stats: {
        reportsAgainst: againstRes.rows.length,
        reportsSubmitted: submittedRes.rows.length,
        contentRemoved: againstRes.rows.filter((r:any) => r.questionId).length,
      },
      suspension: susp ? {
        isSuspended: susp.isSuspended,
        suspendedUntil: susp.suspendedUntil ? new Date(susp.suspendedUntil).toLocaleDateString("en-GB") : null,
        reputation: susp.reputation,
      } : null,
    });
  } catch (error) {
    console.error("Failed to fetch user reports:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

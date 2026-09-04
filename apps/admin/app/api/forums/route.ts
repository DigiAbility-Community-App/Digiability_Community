import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const [questionsResult, statsResult] = await Promise.all([
      dbPool.query(`
        SELECT
          fq.id,
          fq.title,
          fq.category,
          fq.views,
          fq."answerCount",
          fq.status,
          fq."createdAt",
          fq."deletedAt",
          u.name as "authorName",
          u.email as "authorEmail"
        FROM forum_questions fq
        LEFT JOIN users u ON fq."authorId" = u.id
        ORDER BY fq."createdAt" DESC
        LIMIT 100
      `),
      dbPool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'SOLVED' THEN 1 END) as solved,
          COUNT(CASE WHEN status = 'UNSOLVED' THEN 1 END) as unsolved,
          COUNT(CASE WHEN "deletedAt" IS NOT NULL THEN 1 END) as deleted,
          COALESCE(SUM(views), 0) as "totalViews",
          COALESCE(SUM("answerCount"), 0) as "totalAnswers"
        FROM forum_questions
      `),
    ]);

    const questions = questionsResult.rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      views: row.views,
      answerCount: row.answerCount,
      status: row.status,
      createdAtISO: row.createdAt,
      createdAt: new Date(row.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      isDeleted: row.deletedAt !== null,
      authorName: row.authorName,
      authorEmail: row.authorEmail,
    }));

    const s = statsResult.rows[0];

    return NextResponse.json({
      success: true,
      questions,
      stats: {
        total: s.total,
        solved: s.solved,
        unsolved: s.unsolved,
        deleted: s.deleted,
        totalViews: s.totalViews,
        totalAnswers: s.totalAnswers,
      },
    });
  } catch (error) {
    console.error("Failed to fetch forums:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { questionId } = await request.json();
    await dbPool.query(
      `UPDATE forum_questions SET "deletedAt" = NOW() WHERE id = $1`,
      [questionId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete question:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

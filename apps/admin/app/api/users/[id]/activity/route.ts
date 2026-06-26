import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await dbPool.query(`
      SELECT id,'question' AS type,title AS content,category,"createdAt","deletedAt",
             views,"answerCount",status::text AS status,
             NULL::boolean AS "isAccepted",0 AS upvotes,0 AS downvotes,
             NULL::text AS "questionTitle",NULL::uuid AS "questionId"
      FROM forum_questions WHERE "authorId" = $1
      UNION ALL
      SELECT fa.id,'answer' AS type,fa.content,fq.category,fa."createdAt",fa."deletedAt",
             0,0,NULL,fa."isAccepted",fa.upvotes,fa.downvotes,fq.title,fq.id
      FROM forum_answers fa JOIN forum_questions fq ON fa."questionId"=fq.id
      WHERE fa."authorId" = $1
      ORDER BY "createdAt" DESC LIMIT 50
    `, [id]);

    const activities = result.rows.map((row) => ({
      id: row.id, type: row.type,
      content: row.content || "",
      category: row.category || "",
      createdAt: new Date(row.createdAt).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}),
      isDeleted: row.deletedAt !== null,
      views: Number(row.views) || 0,
      answerCount: Number(row.answerCount) || 0,
      status: row.status || null,
      isAccepted: row.isAccepted ?? false,
      upvotes: Number(row.upvotes) || 0,
      downvotes: Number(row.downvotes) || 0,
      questionTitle: row.questionTitle || null,
      questionId: row.questionId || null,
    }));

    return NextResponse.json({ success: true, activities });
  } catch (error) {
    console.error("Failed to fetch user activity:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

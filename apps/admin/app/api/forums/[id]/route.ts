import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";
import { ADMIN_REPLY_USER_ID, ADMIN_REPLY_EMAIL } from "@/lib/adminIdentity";

// GET — question detail with all answers
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    const [questionResult, answersResult] = await Promise.all([
      dbPool.query(
        `SELECT
          fq.id, fq.title, fq.description, fq.category, fq.views,
          fq."answerCount", fq.status, fq."createdAt", fq."deletedAt",
          u.name as "authorName", u.email as "authorEmail"
        FROM forum_questions fq
        JOIN users u ON fq."authorId" = u.id
        WHERE fq.id = $1`,
        [id]
      ),
      dbPool.query(
        `SELECT
          fa.id, fa.content, fa."createdAt", fa."isAccepted",
          fa.upvotes, fa.downvotes, fa."deletedAt",
          u.name as "authorName", u.email as "authorEmail"
        FROM forum_answers fa
        JOIN users u ON fa."authorId" = u.id
        WHERE fa."questionId" = $1 AND fa."deletedAt" IS NULL
        ORDER BY fa."isAccepted" DESC, fa.upvotes DESC, fa."createdAt" ASC`,
        [id]
      ),
    ]);

    if (questionResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 });
    }

    const q = questionResult.rows[0];
    return NextResponse.json({
      success: true,
      question: {
        id: q.id,
        title: q.title,
        description: q.description,
        category: q.category,
        views: q.views,
        answerCount: q.answerCount,
        status: q.status,
        isDeleted: q.deletedAt !== null,
        createdAt: new Date(q.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
        authorName: q.authorName,
        authorEmail: q.authorEmail,
      },
      answers: answersResult.rows.map((a) => ({
        id: a.id,
        content: a.content,
        isAccepted: a.isAccepted,
        upvotes: a.upvotes,
        downvotes: a.downvotes,
        authorName: a.authorName,
        authorEmail: a.authorEmail,
        createdAt: new Date(a.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch question detail:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// POST — admin posts a reply to a question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const { content } = await request.json();

    if (!content?.trim()) {
      return NextResponse.json({ success: false, message: "Reply content is required" }, { status: 400 });
    }

    // Verify question exists
    const qCheck = await dbPool.query(
      `SELECT id FROM forum_questions WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );
    if (qCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Question not found" }, { status: 404 });
    }

    // Insert the answer
    const answerResult = await dbPool.query(
      `INSERT INTO forum_answers
         (id, "questionId", content, "authorId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING id, content, "createdAt"`,
      [id, content.trim(), ADMIN_REPLY_USER_ID]
    );

    // Increment answerCount on the question
    await dbPool.query(
      `UPDATE forum_questions SET "answerCount" = "answerCount" + 1, "updatedAt" = NOW() WHERE id = $1`,
      [id]
    );

    const answer = answerResult.rows[0];
    // Read the author back rather than asserting it: this response used to
    // hardcode a name/email that did not match the row it had just inserted,
    // so the reply displayed correctly until the first reload and then
    // reverted to the bot's name.
    const authorResult = await dbPool.query(
      `SELECT name, email FROM users WHERE id = $1`,
      [ADMIN_REPLY_USER_ID]
    );
    const author = authorResult.rows[0];

    return NextResponse.json({
      success: true,
      answer: {
        id: answer.id,
        content: answer.content,
        authorName: author?.name ?? "DigiAbility Admin",
        authorEmail: author?.email ?? ADMIN_REPLY_EMAIL,
        isAccepted: false,
        upvotes: 0,
        downvotes: 0,
        createdAt: new Date(answer.createdAt).toLocaleDateString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
        }),
      },
    });
  } catch (error) {
    console.error("Failed to post admin reply:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// PATCH — mark an answer as accepted / restore a deleted question
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const body = await request.json();

    if (body.markSolved) {
      await dbPool.query(
        `UPDATE forum_questions SET status = 'SOLVED', "updatedAt" = NOW() WHERE id = $1`,
        [id]
      );
    }

    if (body.restore) {
      await dbPool.query(
        `UPDATE forum_questions SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE id = $1`,
        [id]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update question:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

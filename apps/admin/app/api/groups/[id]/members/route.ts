import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// GET — list members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await dbPool.query(`
      SELECT cm.id, cm."userId", cm.role::text, cm."joinedAt",
             u.name, u.email
      FROM conversation_members cm
      JOIN users u ON cm."userId" = u.id
      WHERE cm."conversationId" = $1 AND cm."leftAt" IS NULL
      ORDER BY cm."joinedAt" ASC
    `, [id]);

    return NextResponse.json({
      success: true,
      members: result.rows.map(m => ({
        ...m,
        joinedAt: new Date(m.joinedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      })),
    });
  } catch (error) {
    console.error("Members GET error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// POST — add a member
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, role = "MEMBER" } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
    }

    // Verify user exists
    const userCheck = await dbPool.query(`SELECT id, name FROM users WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Verify group exists
    const groupCheck = await dbPool.query(
      `SELECT id, "subType" FROM conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const subType = groupCheck.rows[0].subType;
    const validRoles = subType === "CARE_CIRCLE"
      ? ["OWNER","CAREGIVER","MENTOR","PROFESSIONAL","MEMBER"]
      : ["OWNER","ADMIN","MEMBER"];
    const safeRole = validRoles.includes(role) ? role : "MEMBER";

    await dbPool.query(`
      INSERT INTO conversation_members
        (id, "conversationId", "userId", role, "joinedAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3::"MemberRole", NOW(), NOW())
      ON CONFLICT ("conversationId", "userId")
        DO UPDATE SET "leftAt" = NULL, role = $3::"MemberRole", "updatedAt" = NOW()
    `, [id, userId, safeRole]);

    return NextResponse.json({ success: true, userName: userCheck.rows[0].name });
  } catch (error) {
    console.error("Member POST error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

// DELETE — remove a member (?userId=xxx)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId query param required" }, { status: 400 });
    }

    await dbPool.query(`
      UPDATE conversation_members
      SET "leftAt" = NOW(), "updatedAt" = NOW()
      WHERE "conversationId" = $1 AND "userId" = $2
    `, [id, userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Member DELETE error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

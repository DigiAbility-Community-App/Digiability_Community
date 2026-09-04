import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { dbPool } from "@/lib/db";

// A group can have at most this many admin-capable members (OWNER counts
// toward this) — mirrors MAX_ADMINS_PER_GROUP in chat-svc's roles.util.ts.
const MAX_ADMINS_PER_GROUP = 3;

function adminRoleFor(subType: string): string {
  return subType === "CARE_CIRCLE" ? "CAREGIVER" : "ADMIN";
}

// GET — list members
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

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

// POST — add a member, or change an existing member's role (upsert).
// OWNER cannot be assigned here — that's a deliberate, separate action via
// POST /api/groups/[id]/transfer-ownership.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const { userId, role = "MEMBER" } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId is required" }, { status: 400 });
    }

    if (role === "OWNER") {
      return NextResponse.json(
        { success: false, message: "OWNER cannot be assigned here. Use Transfer Ownership instead." },
        { status: 400 }
      );
    }

    // Verify user exists
    const userCheck = await dbPool.query(`SELECT id, name FROM users WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    // Verify group exists
    const groupCheck = await dbPool.query(
      `SELECT id, "subType", "maxMembers" FROM conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );
    if (groupCheck.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }

    const subType = groupCheck.rows[0].subType;
    const maxMembers = groupCheck.rows[0].maxMembers;
    const validRoles = subType === "CARE_CIRCLE"
      ? ["CAREGIVER","MENTOR","PROFESSIONAL","MEMBER"]
      : ["ADMIN","MEMBER"];
    const safeRole = validRoles.includes(role) ? role : "MEMBER";
    const adminRole = adminRoleFor(subType);

    // Only enforce the cap for a genuinely new member — re-adding an already
    // active member (e.g. a role change) is an upsert below, not growth.
    const activeCheck = await dbPool.query(
      `SELECT role::text FROM conversation_members WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      [id, userId]
    );
    const existingRole = activeCheck.rows[0]?.role as string | undefined;
    const isAlreadyActiveMember = activeCheck.rows.length > 0;

    if (existingRole === "OWNER") {
      return NextResponse.json(
        { success: false, message: "Cannot change the owner's role. Transfer ownership instead." },
        { status: 400 }
      );
    }

    if (!isAlreadyActiveMember) {
      const countRes = await dbPool.query(
        `SELECT COUNT(*)::int AS count FROM conversation_members WHERE "conversationId" = $1 AND "leftAt" IS NULL`,
        [id]
      );
      if (countRes.rows[0].count >= maxMembers) {
        return NextResponse.json(
          { success: false, message: `Group has reached its member limit of ${maxMembers}.` },
          { status: 400 }
        );
      }
    }

    // Enforce the max-3-admin cap when this assignment is a NEW promotion
    // to the group's admin role (not re-affirming an existing admin, and
    // not a demotion — those never increase the count).
    if (safeRole === adminRole && existingRole !== adminRole) {
      const adminCountRes = await dbPool.query(
        `SELECT COUNT(*)::int AS count FROM conversation_members
         WHERE "conversationId" = $1 AND "leftAt" IS NULL AND role::text IN ('OWNER', $2)`,
        [id, adminRole]
      );
      if (adminCountRes.rows[0].count >= MAX_ADMINS_PER_GROUP) {
        return NextResponse.json(
          { success: false, message: `This group already has the maximum of ${MAX_ADMINS_PER_GROUP} admins.` },
          { status: 400 }
        );
      }
    }

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

// DELETE — remove a member (?userId=xxx). Goes through chat-svc's internal
// API so removal broadcasts in real time and triggers an admin-succession
// check; falls back to a direct DB update (with an OWNER guard, but no
// succession check) if chat-svc/the internal secret aren't configured.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ success: false, message: "userId query param required" }, { status: 400 });
    }

    const chatSvcUrl = process.env.CHAT_SVC_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (chatSvcUrl && internalSecret) {
      try {
        const res = await fetch(`${chatSvcUrl}/api/internal/groups/${id}/members/${userId}`, {
          method: "DELETE",
          headers: {
            "x-internal-secret": internalSecret,
            "x-internal-ts": String(Date.now()),
          },
        });
        if (res.ok) {
          return NextResponse.json({ success: true });
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 || res.status === 404) {
          // A real validation error (e.g. "cannot remove the owner") —
          // surface it instead of silently falling back to raw SQL, which
          // has no such guard.
          return NextResponse.json({ success: false, message: data.message || "Failed to remove member." }, { status: res.status });
        }
        console.warn(`chat-svc internal member remove returned status ${res.status}, falling back to direct DB update.`);
      } catch (svcErr) {
        console.warn("Failed to reach chat-svc for member removal, falling back to direct DB update:", svcErr);
      }
    }

    // Fallback: direct DB update — still refuses to remove the OWNER
    // (previously had no role check at all), but can't run a succession
    // check without chat-svc's business logic.
    const roleCheck = await dbPool.query(
      `SELECT role::text FROM conversation_members WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      [id, userId]
    );
    if (roleCheck.rows[0]?.role === "OWNER") {
      return NextResponse.json(
        { success: false, message: "Cannot remove the owner. Transfer ownership first." },
        { status: 400 }
      );
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

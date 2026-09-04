import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";

function adminRoleFor(subType: string): string {
  return subType === "CARE_CIRCLE" ? "CAREGIVER" : "ADMIN";
}

// POST /api/groups/[id]/transfer-ownership
// Body: { newOwnerId: string }
// The deliberate "Super Admin can change this admin" action — distinct
// from the automatic succession that promotes a stand-in when an admin is
// deleted/suspended/banned. Goes through chat-svc's internal API (one
// transaction: old owner demoted, new owner promoted, createdBy updated,
// WS broadcast) with a raw-SQL fallback if chat-svc is unreachable.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(req);
  if (authError) return authError;

  try {
    const { id } = await params;
    const { newOwnerId } = await req.json();

    if (!newOwnerId) {
      return NextResponse.json({ success: false, message: "newOwnerId is required" }, { status: 400 });
    }

    const groupRes = await dbPool.query(
      `SELECT id, "subType" FROM chat.conversations WHERE id = $1 AND "deletedAt" IS NULL`,
      [id]
    );
    if (groupRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Group not found" }, { status: 404 });
    }
    const subType = groupRes.rows[0].subType;

    const targetRes = await dbPool.query(
      `SELECT role::text FROM chat.conversation_members WHERE "conversationId" = $1 AND "userId" = $2 AND "leftAt" IS NULL`,
      [id, newOwnerId]
    );
    if (targetRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: "Target user is not an active member of this group" }, { status: 400 });
    }
    if (targetRes.rows[0].role === "OWNER") {
      return NextResponse.json({ success: false, message: "This user is already the owner" }, { status: 400 });
    }

    const chatSvcUrl = process.env.CHAT_SVC_URL;
    const internalSecret = process.env.INTERNAL_API_SECRET;

    if (chatSvcUrl && internalSecret) {
      try {
        const res = await fetch(`${chatSvcUrl}/api/internal/groups/${id}/transfer-ownership`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": internalSecret,
            "x-internal-ts": String(Date.now()),
          },
          body: JSON.stringify({ newOwnerId }),
        });
        if (res.ok) {
          return NextResponse.json({ success: true });
        }
        const data = await res.json().catch(() => ({}));
        console.warn(`chat-svc internal transfer-ownership returned status ${res.status} (${data.message}), falling back to direct DB update.`);
      } catch (svcErr) {
        console.warn("Failed to reach chat-svc for ownership transfer, falling back to direct DB update:", svcErr);
      }
    }

    // Fallback: direct DB update, mirroring chat-svc's own transaction —
    // old active owner (if any) demoted to the group's admin role, new
    // owner promoted, createdBy updated. No WS broadcast in this path.
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      const demotedRole = adminRoleFor(subType);
      await client.query(
        `UPDATE chat.conversation_members SET role = $3::"chat"."MemberRole", "updatedAt" = NOW()
         WHERE "conversationId" = $1 AND role = 'OWNER' AND "leftAt" IS NULL AND "userId" != $2`,
        [id, newOwnerId, demotedRole]
      );
      await client.query(
        `UPDATE chat.conversation_members SET role = 'OWNER'::"chat"."MemberRole", "updatedAt" = NOW()
         WHERE "conversationId" = $1 AND "userId" = $2`,
        [id, newOwnerId]
      );
      await client.query(
        `UPDATE chat.conversations SET "createdBy" = $2, "updatedAt" = NOW() WHERE id = $1`,
        [id, newOwnerId]
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Transfer ownership error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

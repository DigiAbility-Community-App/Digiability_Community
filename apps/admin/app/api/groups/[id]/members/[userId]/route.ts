import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { dbPool } from "@/lib/db";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/groups/:id/members/:userId — remove a member. The user id is a
// path segment, not a query string (VAPT: sensitive information in URL).
// Goes through chat-svc's internal
// API so removal broadcasts in real time and triggers an admin-succession
// check; falls back to a direct DB update (with an OWNER guard, but no
// succession check) if chat-svc/the internal secret aren't configured.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    const { id, userId } = await params;

    // Both ids are interpolated into a chat-svc URL below — accept UUIDs only.
    if (!UUID_RE.test(id) || !UUID_RE.test(userId)) {
      return NextResponse.json({ success: false, message: "Invalid group or user id" }, { status: 400 });
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

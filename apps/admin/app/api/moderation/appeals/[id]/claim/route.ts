import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const USER_SVC = process.env.USER_SVC_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function internalHeaders() {
  return {
    "Content-Type": "application/json",
    "x-internal-secret": INTERNAL_SECRET,
    "x-internal-ts": String(Date.now()),
  };
}

// POST /api/moderation/appeals/[id]/claim
//
// Moves an appeal to UNDER_REVIEW and records who picked it up, so two admins
// don't unknowingly work the same one. As with deciding, the reviewer comes
// from the session rather than the body — the "not the original decider" rule
// is only meaningful if the identity can't be supplied by the caller.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    const { id } = await params;

    const res = await fetch(`${USER_SVC}/api/moderation/appeals/${id}/claim`, {
      method: "POST",
      headers: internalHeaders(),
      body: JSON.stringify({ reviewerEmail: actor?.email }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };

    if (res.ok) {
      await writeAudit({
        adminEmail: actor?.email,
        ipAddress: ip,
        action: "appeal_claimed",
        targetType: "appeal",
        targetId: id,
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to claim appeal" },
      { status: 500 }
    );
  }
}

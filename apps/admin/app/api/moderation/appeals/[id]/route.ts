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

// PATCH /api/moderation/appeals/[id]
// Body: { outcome: "UPHELD" | "OVERTURNED" | "REJECTED", decisionNote: string }
//
// The reviewer's identity is taken from the session, never the request body —
// otherwise the "not the original decider" rule could be sidestepped by
// sending someone else's email.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const res = await fetch(`${USER_SVC}/api/moderation/appeals/${id}`, {
      method: "PATCH",
      headers: internalHeaders(),
      body: JSON.stringify({ ...body, reviewerEmail: actor?.email }),
    });
    const data = (await res.json()) as { success?: boolean; message?: string };

    if (res.ok) {
      await writeAudit({
        adminEmail: actor?.email,
        ipAddress: ip,
        action: `appeal_${String(body.outcome ?? "decided").toLowerCase()}`,
        targetType: "appeal",
        targetId: id,
        reason: typeof body.decisionNote === "string" ? body.decisionNote : null,
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to decide appeal" }, { status: 500 });
  }
}

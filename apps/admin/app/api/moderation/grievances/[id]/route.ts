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

// PATCH /api/moderation/grievances/[id]
// Body: { action: "acknowledge" | "resolve", resolutionNote?: string }
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

    // The acting admin is stamped on the ticket, so "who acknowledged this"
    // is answerable — user-svc rejects the call without it.
    const res = await fetch(`${USER_SVC}/api/moderation/grievances/${id}`, {
      method: "PATCH",
      headers: internalHeaders(),
      body: JSON.stringify({ ...body, adminEmail: actor?.email }),
    });
    const data = (await res.json()) as unknown;

    if (res.ok) {
      await writeAudit({
        adminEmail: actor?.email,
        ipAddress: ip,
        action: body.action === "resolve" ? "grievance_resolved" : "grievance_acknowledged",
        targetType: "grievance",
        targetId: id,
        reason: typeof body.resolutionNote === "string" ? body.resolutionNote : null,
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { success: false, message: "Failed to update grievance" },
      { status: 500 }
    );
  }
}

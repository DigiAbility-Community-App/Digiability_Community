import { NextRequest, NextResponse } from "next/server";
import { dbPool } from "@/lib/db";
import { requireAdminAuth, getAdminSession, getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

// GET /api/users/[id]/guardian-attestations
//
// Confirmations this user made about someone in their care (DPDP §9).
// Needed to investigate a grievance about a Care Circle: without it there is no
// way to answer "who said they were responsible for this person, and when".
//
// NOTE: these are self-attested, not verified consent. See guardian.service.ts
// in user-svc and docs/legal/06 §1.7 before treating them as satisfying §9.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth(request);
  if (authError) return authError;
  const actor = await getAdminSession(request);
  const ip = getRequestIp(request);

  try {
    const { id } = await params;

    const result = await dbPool.query(
      `SELECT ga.id,
              ga."subjectName",
              ga."subjectIsMinor",
              ga.relationship,
              ga."conversationId",
              ga."policyVersion",
              ga."attestedAt",
              ga."revokedAt",
              c.name AS "careCircleName"
         FROM guardian_attestations ga
         LEFT JOIN chat.conversations c ON c.id = ga."conversationId"
        WHERE ga."guardianUserId" = $1
        ORDER BY ga."attestedAt" DESC`,
      [id]
    );

    // Reading who a user declared responsibility for is a look at sensitive
    // personal data about a third party, so the access itself is recorded.
    await writeAudit({
      adminEmail: actor?.email,
      ipAddress: ip,
      action: "guardian_attestations_viewed",
      targetType: "user",
      targetId: id,
      message: `${result.rows.length} attestation(s)`,
    });

    return NextResponse.json({ success: true, data: { attestations: result.rows } });
  } catch (err) {
    console.error("Guardian attestations query failed:", err);
    return NextResponse.json(
      { success: false, message: "Failed to load guardian attestations" },
      { status: 500 }
    );
  }
}

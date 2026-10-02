import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { revokeAllAdminSessions } from "@/lib/adminSessions.server";
import { SESSION_COOKIE, requestIsHttps } from "@/lib/session";

/**
 * "Sign out of all devices": revoke every session for the signed-in admin,
 * including this one. For a lost laptop, or a "Keep me signed in" session
 * left on a shared machine.
 */
export async function POST(request: NextRequest) {
  const actor = await getAdminSession(request);
  if (!actor) {
    return NextResponse.json({ success: false, message: "Session expired" }, { status: 401 });
  }

  try {
    const revoked = await revokeAllAdminSessions(actor.email, "logout_all");
    await writeAudit({
      adminEmail: actor.email,
      ipAddress: getRequestIp(request),
      action: "admin_logout_all",
      targetType: "admin",
      targetId: actor.email,
      reason: `Signed out of ${revoked} session${revoked === 1 ? "" : "s"}`,
    });

    const response = NextResponse.json({ success: true, revoked });
    response.cookies.set(SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      secure: requestIsHttps(request),
      sameSite: "strict",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("[admin-logout-all] failed:", error);
    return NextResponse.json(
      { success: false, message: "Could not sign out other devices. Please try again." },
      { status: 500 }
    );
  }
}

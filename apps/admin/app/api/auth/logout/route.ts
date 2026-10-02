import { NextRequest, NextResponse } from "next/server";
import { verifyJWTSignature } from "@/lib/jwt";
import { getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { revokeAdminSession } from "@/lib/adminSessions.server";
import { SESSION_COOKIE, requestIsHttps } from "@/lib/session";

/**
 * End this session: revoke it server-side, then clear the cookie.
 *
 * Clearing the cookie alone used to be all logout did, so a copied token kept
 * working until its deadline. The signature is still verified (expired tokens
 * accepted) so a forged cookie can't be used to revoke someone else's session.
 *
 * POST only. The GET variant let any website log an admin out by linking to
 * it, and nothing in the panel used it.
 */
export async function POST(request: NextRequest) {
  const payload = await readSignedPayload(request);

  if (payload?.sid) {
    try {
      await revokeAdminSession(payload.sid, "logout");
      await writeAudit({
        adminEmail: typeof payload.email === "string" ? payload.email : null,
        ipAddress: getRequestIp(request),
        action: "admin_logout",
        targetType: "admin",
        targetId: typeof payload.email === "string" ? payload.email : null,
      });
    } catch (e) {
      // Still clear the cookie — the user asked to leave.
      console.error("[admin-logout] could not revoke session:", e);
    }
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set(SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    secure: requestIsHttps(request),
    sameSite: "strict",
    maxAge: 0, // Expire immediately
  });
  return response;
}

/**
 * Signature-checked payload, accepting an expired token: an admin whose idle
 * window just lapsed should still be able to revoke that session's row.
 */
async function readSignedPayload(request: NextRequest): Promise<Record<string, any> | null> {
  const secret = process.env.JWT_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret || !token) return null;
  return verifyJWTSignature(token, secret);
}

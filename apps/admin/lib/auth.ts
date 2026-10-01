import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "./jwt";

/**
 * Verify the admin session cookie inside an API route handler.
 * Returns null if valid, or a NextResponse error if invalid/missing.
 *
 * Usage in any API route:
 *   const authError = await requireAdminAuth(request);
 *   if (authError) return authError;
 */
export async function requireAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
  }

  const sessionCookie = request.cookies.get("admin-session");
  if (!sessionCookie?.value) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyJWT(sessionCookie.value, secret);

  // An expired/invalid token is an authentication problem, not an
  // authorisation one — it must be 401 so the client can tell "your session
  // ended, log in again" apart from "you're logged in but not allowed here".
  // This returned 403, while the client only treated 401 as session-expired,
  // so expiry was never detected and requests just failed silently.
  if (!payload) {
    return NextResponse.json({ success: false, message: "Session expired" }, { status: 401 });
  }
  if (payload.role !== "admin") {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  return null; // auth passed
}

/**
 * Non-rejecting version of the same check, for routes that serve a public
 * subset of data to anyone but a fuller view to a logged-in admin (e.g. the
 * services directory: published rows are public, drafts are admin-only).
 * Never throws/returns an error response — just tells the caller whether
 * this request carries a valid admin session.
 */
export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;

  const sessionCookie = request.cookies.get("admin-session");
  if (!sessionCookie?.value) return false;

  const payload = await verifyJWT(sessionCookie.value, secret);
  return !!payload && payload.role === "admin";
}

export interface AdminSession {
  /** Email of the signed-in admin. This is the actor id for the audit trail. */
  email: string;
  role: string;
}

/**
 * Return the decoded admin session, or null if the request carries none.
 *
 * `requireAdminAuth` verifies the same token but returns only null-or-error, so
 * it throws the payload away. That is why every audit row used to be attributed
 * to the literal string "admin-panel" — the real identity was available on every
 * request and simply never read. Use this alongside requireAdminAuth when you
 * need to record who acted.
 */
export async function getAdminSession(request: NextRequest): Promise<AdminSession | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;

  const sessionCookie = request.cookies.get("admin-session");
  if (!sessionCookie?.value) return null;

  const payload = await verifyJWT(sessionCookie.value, secret);
  if (!payload || payload.role !== "admin" || typeof payload.email !== "string") {
    return null;
  }
  return { email: payload.email, role: payload.role };
}

/**
 * Best-effort client IP for the audit trail, truncated to a /24 (IPv4) or /48
 * (IPv6) for data minimisation — the same treatment UserConsent.ipAddress gets
 * in user-svc. Identifies a network for investigation purposes, not a device.
 */
export function getRequestIp(request: NextRequest): string | null {
  const raw =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  if (!raw) return null;

  const v4 = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  if (v4) return `${v4[1]}.0`;

  const parts = raw.split(":");
  if (parts.length >= 3) return parts.slice(0, 3).join(":") + "::";
  return null;
}

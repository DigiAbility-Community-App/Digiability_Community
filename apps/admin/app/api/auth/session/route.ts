import { NextRequest, NextResponse } from "next/server";
import { verifyJWT, signJWT } from "@/lib/jwt";
import {
  ABSOLUTE_SESSION_HOURS,
  SESSION_COOKIE,
  requestIsHttps,
  sessionCookieOptions,
} from "@/lib/session";
import { getIdleTimeoutMinutes } from "@/lib/sessionPolicy.server";

/**
 * Session status + sliding renewal.
 *
 * GET  — report whether the session is still valid and when it expires, so an
 *        idle tab can log itself out instead of sitting there looking signed
 *        in. Does NOT extend the session.
 * POST — the admin is actively working: push the idle deadline forward, but
 *        never past the absolute deadline (`abs`) fixed at login.
 */
async function readSession(request: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return { secret: null, payload: null };
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return { secret, payload: null };
  const payload = await verifyJWT(cookie.value, secret);
  if (!payload || payload.role !== "admin") return { secret, payload: null };
  return { secret, payload };
}

export async function GET(request: NextRequest) {
  const { payload } = await readSession(request);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    // Seconds remaining before the idle deadline — drives the client's
    // countdown/warning without it needing to read the httpOnly cookie.
    expiresIn: Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
    absoluteExpiresIn: typeof payload.abs === "number"
      ? Math.max(0, payload.abs - Math.floor(Date.now() / 1000))
      : null,
  });
}

export async function POST(request: NextRequest) {
  const { secret, payload } = await readSession(request);
  if (!secret || !payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const idleMinutes = await getIdleTimeoutMinutes();
  // Sessions issued before absolute deadlines existed have no `abs`. Grant
  // them a full window from now rather than treating "missing" as "expired",
  // which would have logged every already-signed-in admin out on their first
  // activity ping. They pick up a real `abs` from this renewal onward.
  const abs = typeof payload.abs === "number"
    ? payload.abs
    : nowSec + ABSOLUTE_SESSION_HOURS * 60 * 60;

  // Sliding renewal stops at the absolute ceiling — an admin who never stops
  // clicking still gets forced back to the login screen eventually.
  if (nowSec >= abs) {
    const expired = NextResponse.json(
      { authenticated: false, reason: "absolute_timeout" },
      { status: 401 }
    );
    expired.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return expired;
  }

  const exp = Math.min(nowSec + idleMinutes * 60, abs);
  const token = await signJWT(
    { email: payload.email, role: "admin", exp, abs, remember: payload.remember === true },
    secret
  );

  const response = NextResponse.json({
    authenticated: true,
    expiresIn: exp - nowSec,
    absoluteExpiresIn: abs - nowSec,
  });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions({ isHttps: requestIsHttps(request), remember: payload.remember === true })
  );
  return response;
}

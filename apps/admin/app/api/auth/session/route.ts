import { NextRequest, NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { verifyAdminToken } from "@/lib/auth";
import { touchAdminSession } from "@/lib/adminSessions.server";
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
 *        never past the absolute deadline (`abs`) fixed at login. A "Keep me
 *        signed in" session has no idle window, so it is not extended.
 *
 * Both reject a session revoked server-side (logout elsewhere, "sign out of
 * all devices"), which is how an open tab finds out it was signed out.
 */
async function readSession(request: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) return { secret: null, payload: null };
  const payload = await verifyAdminToken(request);
  if (!payload || payload.role !== "admin") return { secret, payload: null };
  return { secret, payload };
}

function remaining(deadline: unknown, nowSec: number): number | null {
  return typeof deadline === "number" ? Math.max(0, deadline - nowSec) : null;
}

export async function GET(request: NextRequest) {
  const { payload } = await readSession(request);
  if (!payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  return NextResponse.json({
    authenticated: true,
    // The signed-in admin's own email. Needed by the appeals page to explain
    // why an appeal is locked ("you made this decision") before the request is
    // made — the server remains the authority on that rule.
    email: payload.email ?? null,
    // Lets the client skip the idle countdown for "Keep me signed in".
    remember: payload.remember === true,
    // Seconds remaining before the idle deadline — drives the client's
    // countdown/warning without it needing to read the httpOnly cookie.
    expiresIn: remaining(payload.exp, nowSec) ?? 0,
    absoluteExpiresIn: remaining(payload.abs, nowSec),
  });
}

export async function POST(request: NextRequest) {
  const { secret, payload } = await readSession(request);
  if (!secret || !payload) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const remember = payload.remember === true;

  // Fixed lifetime: nothing to slide, just note the activity.
  if (remember) {
    await touchAdminSession(payload.sid, new Date(payload.exp * 1000));
    return NextResponse.json({
      authenticated: true,
      remember: true,
      expiresIn: remaining(payload.exp, nowSec) ?? 0,
      absoluteExpiresIn: remaining(payload.abs, nowSec),
    });
  }

  const idleMinutes = await getIdleTimeoutMinutes();
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
  await touchAdminSession(payload.sid, new Date(exp * 1000));
  const token = await signJWT(
    { email: payload.email, role: "admin", sid: payload.sid, exp, abs, remember: false },
    secret
  );

  const response = NextResponse.json({
    authenticated: true,
    remember: false,
    expiresIn: exp - nowSec,
    absoluteExpiresIn: abs - nowSec,
  });
  response.cookies.set(
    SESSION_COOKIE,
    token,
    sessionCookieOptions({ isHttps: requestIsHttps(request), remember: false })
  );
  return response;
}

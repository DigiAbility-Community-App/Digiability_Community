import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";
import {
  ABSOLUTE_SESSION_HOURS,
  REMEMBER_ME_DAYS,
  SESSION_COOKIE,
  requestIsHttps,
  sessionCookieOptions,
} from "@/lib/session";
import { getIdleTimeoutMinutes } from "@/lib/sessionPolicy.server";
import { createAdminSession } from "@/lib/adminSessions.server";
import { checkLoginAllowed, recordLoginAttempt } from "@/lib/loginRateLimit";
import { getRequestIp } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);

  try {
    // A missing or non-JSON body is a bad request, not a server error.
    const body = await request.json().catch(() => null);
    const { email, password, rememberMe } = body ?? {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    // This endpoint previously accepted unlimited guesses. See lib/loginRateLimit.
    const verdict = await checkLoginAllowed(email, ip);
    if (!verdict.allowed) {
      await writeAudit({
        adminEmail: null,
        ipAddress: ip,
        action: "admin_login_blocked",
        targetType: "admin",
        targetId: String(email).toLowerCase(),
        reason: "rate limited",
      });
      return NextResponse.json(
        {
          success: false,
          message: `Too many failed attempts. Try again in ${verdict.retryAfterMinutes} minutes.`,
        },
        { status: 429 }
      );
    }

    // Credentials live in data/credentials.json, which is gitignored.
    //
    // This used to fall back to two bcrypt hashes hardcoded right here — so the
    // admin password hashes were in a tracked source file regardless of whether
    // the JSON was committed. They have been removed. The store is now seeded
    // from the environment on first run, or not at all.
    const filePath = path.join(process.cwd(), "data", "credentials.json");
    let credentials: Record<string, string> = {};

    if (fs.existsSync(filePath)) {
      credentials = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } else {
      const seedEmail = process.env.ADMIN_SEED_EMAIL;
      const seedPassword = process.env.ADMIN_SEED_PASSWORD;

      if (!seedEmail || !seedPassword) {
        // Refuse rather than inventing a default account. A predictable
        // bootstrap credential is how this problem started.
        console.error(
          "[admin-login] No credentials store and no ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD set. " +
            "Set both once to create the first admin account, then remove them from the environment."
        );
        return NextResponse.json(
          { success: false, message: "Admin authentication is not configured." },
          { status: 500 }
        );
      }

      credentials = {
        [seedEmail.toLowerCase()]: bcrypt.hashSync(seedPassword, 12),
      };
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), "utf-8");
      console.warn(`[admin-login] Seeded the admin credential store for ${seedEmail}.`);
    }

    const hashedPassword = credentials[email.toLowerCase()];

    // Verify using bcrypt compare
    if (hashedPassword && bcrypt.compareSync(password, hashedPassword)) {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error("JWT_SECRET environment variable is not set");
        return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
      }
      
      // Normal: `exp` is the IDLE deadline (slides while the admin is active,
      // see /api/auth/session) and `abs` the hard ceiling for this login.
      // "Keep me signed in": a fixed REMEMBER_ME_DAYS with no idle window —
      // it previously got the normal 2h/12h token inside a 7-day cookie, so
      // ticking it didn't keep anyone signed in. See lib/session.ts.
      const remember = rememberMe === true;
      const nowSec = Math.floor(Date.now() / 1000);
      let exp: number;
      let abs: number;
      if (remember) {
        abs = nowSec + REMEMBER_ME_DAYS * 24 * 60 * 60;
        exp = abs;
      } else {
        const idleMinutes = await getIdleTimeoutMinutes();
        abs = nowSec + ABSOLUTE_SESSION_HOURS * 60 * 60;
        exp = Math.min(nowSec + idleMinutes * 60, abs);
      }

      // Server-side record of this login; its id rides in the token as `sid`,
      // and revoking the row (logout) ends the session wherever the token is.
      const sid = await createAdminSession({
        email,
        remember,
        expiresAt: new Date(exp * 1000),
        userAgent: request.headers.get("user-agent"),
        ipAddress: ip,
      });

      const token = await signJWT(
        { email: email.toLowerCase(), role: "admin", sid, exp, abs, remember },
        secret
      );

      const response = NextResponse.json(
        { success: true, message: "Login successful" },
        { status: 200 }
      );

      // Set cookie for session
      //
      // `secure` must reflect how THIS request actually arrived, not just
      // NODE_ENV — a Secure cookie set over a plain-HTTP connection is
      // silently discarded by every browser (no Set-Cookie error, it just
      // never gets stored), which made login appear to succeed while every
      // subsequent navigation looked unauthenticated. Live currently runs
      // over plain HTTP with no TLS termination, so NODE_ENV=production
      // alone was wrong here. x-forwarded-proto is checked first so this
      // still resolves to Secure automatically once a TLS-terminating
      // proxy/ingress is added in front.
      const isHttps = requestIsHttps(request);

      // No maxAge unless "Remember me" was ticked — a session cookie dies with
      // the browser. It was previously always persistent for a full day, which
      // is why closing the laptop and reopening left the admin still signed in.
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions({ isHttps, remember }));

      await recordLoginAttempt(email, ip, true);
      await writeAudit({
        adminEmail: email.toLowerCase(),
        ipAddress: ip,
        action: "admin_login_success",
        targetType: "admin",
        targetId: email.toLowerCase(),
      });

      return response;
    }

    // Counted toward the rate limit, and recorded — admin login success and
    // failure were previously not logged at all.
    await recordLoginAttempt(email, ip, false);
    await writeAudit({
      adminEmail: null,
      ipAddress: ip,
      action: "admin_login_failure",
      targetType: "admin",
      targetId: String(email).toLowerCase(),
    });

    return NextResponse.json(
      { success: false, message: "Invalid email or password" },
      { status: 401 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";
import {
  ABSOLUTE_SESSION_HOURS,
  SESSION_COOKIE,
  requestIsHttps,
  sessionCookieOptions,
} from "@/lib/session";
import { getIdleTimeoutMinutes } from "@/lib/sessionPolicy.server";

export async function POST(request: Request) {
  try {
    const { email, password, rememberMe } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: "Email and password are required" },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), "data", "credentials.json");
    
    // Default hashed credentials if file is empty
    let credentials: Record<string, string> = {
      "superadmin@digiability.com": "$2a$10$eBSM.BRyfK1Bw8kfP/UV4.8mGT3iE7aO/B6tODXe.0oW9XBJpLVTq",
      "prathmesh@digiability.com": "$2a$10$tyCeQlnkWqRD09jA7sjrb.ZKG5/78nzltt4e.eL8oK1dTu8tW36UK"
    };

    if (fs.existsSync(filePath)) {
      const fileData = fs.readFileSync(filePath, "utf-8");
      credentials = JSON.parse(fileData);
    } else {
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(credentials, null, 2), "utf-8");
    }

    const hashedPassword = credentials[email.toLowerCase()];

    // Verify using bcrypt compare
    if (hashedPassword && bcrypt.compareSync(password, hashedPassword)) {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error("JWT_SECRET environment variable is not set");
        return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
      }
      
      // `exp` is the IDLE deadline (slides while the admin is active, see
      // /api/auth/session); `abs` is the hard ceiling for this login. It used
      // to be a flat 24h with no idle concept at all.
      const idleMinutes = await getIdleTimeoutMinutes();
      const nowSec = Math.floor(Date.now() / 1000);
      const exp = nowSec + idleMinutes * 60;
      const abs = nowSec + ABSOLUTE_SESSION_HOURS * 60 * 60;
      const remember = rememberMe === true;
      const token = await signJWT(
        { email: email.toLowerCase(), role: "admin", exp, abs, remember },
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

      return response;
    }

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

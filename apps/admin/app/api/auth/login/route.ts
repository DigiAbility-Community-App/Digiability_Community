import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { signJWT } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

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
      
      // Create session payload with 1 day expiration
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
      const token = await signJWT({ email: email.toLowerCase(), role: "admin", exp }, secret);

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
      const isHttps =
        request.headers.get("x-forwarded-proto") === "https" ||
        new URL(request.url).protocol === "https:";

      response.cookies.set("admin-session", token, {
        path: "/",
        httpOnly: true,
        secure: isHttps,
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 1 day
      });

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

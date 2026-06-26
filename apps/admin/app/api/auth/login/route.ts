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
      "admin@digiability.com": "$2a$10$/2Jz4UCbmYJ5XKZeAOrA6OtUvnDh6Dw9.mbn9l4.14qCCtQFpa/su",
      "prathmesh@digiability.com": "$2a$10$2KT4swA30N0Y/2UYPmcto.lVjy/JC0GB5NXRrhNSAp/xJVvnnYjoG"
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
      response.cookies.set("admin-session", token, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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

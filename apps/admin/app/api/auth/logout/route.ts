import { NextResponse } from "next/server";

// secure must reflect how the request actually arrived, not NODE_ENV — see
// the comment in app/api/auth/login/route.ts for why.
function isHttps(request: Request): boolean {
  return (
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:"
  );
}

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  response.cookies.set("admin-session", "", {
    path: "/",
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "strict",
    maxAge: 0, // Expire immediately
  });
  return response;
}

// Support both POST and GET for browser-based logout links
export async function GET(request: Request) {
  const response = NextResponse.redirect(
    new URL("/login", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001")
  );
  response.cookies.set("admin-session", "", {
    path: "/",
    httpOnly: true,
    secure: isHttps(request),
    sameSite: "strict",
    maxAge: 0,
  });
  return response;
}

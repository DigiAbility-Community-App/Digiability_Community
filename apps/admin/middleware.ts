import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "./lib/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("admin-session");
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET is not set — deny all access to force proper configuration.
    // Never redirect /login to itself, or every request 307-loops forever.
    if (pathname === "/login") {
      return NextResponse.next();
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  let isValid = false;

  if (sessionCookie?.value) {
    const payload = await verifyJWT(sessionCookie.value, secret);
    if (payload && payload.role === "admin") {
      isValid = true;
    }
  }

  // Deny by default: every route requires a valid session except this
  // explicit public allowlist, so a newly added dashboard route can't
  // silently bypass auth again the way /groups and /messages did.
  const isPublic = pathname === "/login";

  if (!isPublic && !isValid) {
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    if (sessionCookie) {
      response.cookies.delete("admin-session");
    }
    return response;
  }

  // If already logged in and visiting login, redirect to dashboard
  if (pathname === "/login") {
    if (isValid) {
      const dashboardUrl = new URL("/dashboard", request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

// Matching all routes except static files, api routes, etc.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

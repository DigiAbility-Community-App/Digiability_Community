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
    if (pathname === "/security") {
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
  // /security is the public security-practices page linked from the
  // pre-login footer — it must stay reachable without a session.
  const isPublic = pathname === "/login" || pathname === "/security";

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

// Matching all routes except static files, api routes, etc. The file
// extension exclusion covers every public asset (logo.png, icon.png, etc.)
// — without it, a request for e.g. /logo.png fell through to the
// deny-by-default gate below and got redirected to an HTML /login page,
// which the <Image> tag then failed to decode as a PNG.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJWT } from "./lib/jwt";

// ─── Strict CSP, report-only for now ──────────────────────────────────────
// A per-request nonce lets Next.js mark its own <script> tags, so the policy
// can drop 'unsafe-inline' and rely on 'strict-dynamic'. Next reads the nonce
// from the *request's* Content-Security-Policy header, so it is set there;
// the browser gets the same policy as Content-Security-Policy-Report-Only.
// next.config.js keeps enforcing the looser baseline. Once this produces no
// violations, send it as Content-Security-Policy and drop the baseline.
function strictCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = strictCsp(nonce);
  const withCsp = (response: NextResponse): NextResponse => {
    response.headers.set("Content-Security-Policy-Report-Only", policy);
    return response;
  };
  const next = (): NextResponse => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", policy);
    return withCsp(NextResponse.next({ request: { headers } }));
  };

  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("admin-session");
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET is not set — deny all access to force proper configuration.
    // Never redirect /login to itself, or every request 307-loops forever.
    if (pathname === "/login") {
      return next();
    }
    if (pathname === "/security") {
      return next();
    }
    const loginUrl = new URL("/login", request.url);
    return withCsp(NextResponse.redirect(loginUrl));
  }
  let isValid = false;

  if (sessionCookie?.value) {
    const payload = await verifyJWT(sessionCookie.value, secret);
    // Signature + deadlines only: the edge runtime can't reach Postgres, so a
    // revoked session is caught by the API routes and SessionGuard instead.
    // A token with no `sid` predates server-side sessions and is never valid.
    if (payload && payload.role === "admin" && typeof payload.sid === "string") {
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
    return withCsp(response);
  }

  // If already logged in and visiting login, redirect to dashboard
  if (pathname === "/login") {
    if (isValid) {
      const dashboardUrl = new URL("/dashboard", request.url);
      return withCsp(NextResponse.redirect(dashboardUrl));
    }
  }

  return next();
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

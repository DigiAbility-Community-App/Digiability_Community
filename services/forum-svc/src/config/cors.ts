// ─────────────────────────────────────────────────────
// CORS allowlist + API security headers
//
// CORS_ALLOWED_ORIGINS is a comma-separated list of exact origins allowed to
// call this API from a browser, e.g.
//   https://community.digiability.in,https://admin.community.digiability.in
//
// In production the service refuses to start if the list is missing, still a
// placeholder (production once answered every request with the literal
// "Access-Control-Allow-Origin: CHANGE_ME"), contains "*", or has anything
// other than https origins. Requests from a disallowed origin get no CORS
// headers at all; "*" is never sent, so credentials are never exposed to
// arbitrary sites. Native apps send no Origin header and are unaffected.
//
// This file is duplicated per service (services share no source); keep the
// copies in step.
// ─────────────────────────────────────────────────────

const PLACEHOLDER = /CHANGE_ME|REPLACE|your[_-]|example|placeholder|localhost|127\.0\.0\.1/i;

// Local web app, admin panel and Expo web.
const DEV_DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
];

export function parseAllowedOrigins(raw: string | undefined, isProduction: boolean): string[] {
  if (!raw || !raw.trim()) {
    if (isProduction) {
      throw new Error("CORS_ALLOWED_ORIGINS is not set. Set it to the exact https origins allowed to call this API.");
    }
    return DEV_DEFAULT_ORIGINS;
  }

  const origins = raw
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (origins.length === 0) throw new Error("CORS_ALLOWED_ORIGINS has no origins.");

  for (const origin of origins) {
    if (origin.includes("*")) {
      throw new Error(`CORS_ALLOWED_ORIGINS must list exact origins, not "${origin}".`);
    }
    if (!isProduction) continue;

    if (PLACEHOLDER.test(origin)) {
      throw new Error(`CORS_ALLOWED_ORIGINS still contains a placeholder or local value: "${origin}".`);
    }
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS_ALLOWED_ORIGINS entry is not a valid origin: "${origin}".`);
    }
    if (url.protocol !== "https:" || url.origin !== origin) {
      throw new Error(`CORS_ALLOWED_ORIGINS entries must be bare https origins (e.g. https://app.example.org): "${origin}".`);
    }
  }
  return origins;
}

/**
 * Read and validate the allowlist at startup. On a bad production value the
 * process exits with a clear message instead of serving with a broken policy.
 */
export function loadAllowedOrigins(): string[] {
  try {
    return parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS, process.env.NODE_ENV === "production");
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

/** `origin` option for the cors middleware: echo allowed origins, nothing else. */
export function corsOriginCheck(allowed: string[]) {
  const allow = new Set(allowed);
  return (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void => {
    cb(null, !origin || allow.has(origin));
  };
}

/** helmet options for a JSON API (no HTML is ever served). */
export const API_HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
  },
  crossOriginEmbedderPolicy: false,
  // same-site, not helmet's default same-origin: the web app on
  // community.digiability.in loads media from the api/chat/forum subdomains.
  crossOriginResourcePolicy: { policy: "same-site" as const },
  referrerPolicy: { policy: "no-referrer" as const },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
};

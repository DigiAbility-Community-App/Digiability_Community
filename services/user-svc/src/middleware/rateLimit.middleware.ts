import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../config/redis";

// ─────────────────────────────────────────────────────
// Rate-Limiting Middleware — user-svc
//
// Backed by Redis so limits are shared across horizontally
// scaled instances. All limiters key by IP address.
//
// Limits (conservative for a healthcare community app):
//   /login            — 5 per 15 min  (brute-force guard)
//   /register         — 10 per hour
//   /forgot-password  — 5 per hour    (avoids email flooding)
//   /reset-password   — 5 per hour
//   /verify-email     — 10 per hour  (per IP)
//   /resend-otp       — 5 per hour PER EMAIL, plus 20 per hour per IP
//   Global API        — 200 per min   (all other routes)
//
// Per-ACCOUNT limits (keyed by the email in the body) run alongside the IP
// limits on the credential-guessing routes, so an attacker rotating IPs
// still can't hammer one account:
//   /login            — 10 failed attempts per hour per email
//   /verify-email     — 10 per hour per email
//   /forgot-password  — 3 per hour per email   (each one sends an email)
//   /reset-password   — 5 per hour per email
//
// Note on /resend-otp keying: it is limited by EMAIL, not IP. Indian mobile
// carriers put large numbers of subscribers behind carrier-grade NAT, so an
// IP-keyed resend budget is shared between strangers — one person retrying
// could lock out everyone else on the same carrier egress. The email key makes
// the budget follow the account it is protecting. A looser IP limit still runs
// alongside it so the endpoint cannot be used as a mail cannon across many
// addresses.
// ─────────────────────────────────────────────────────

function makeStore(prefix: string) {
  const client = getRedis();
  return new RedisStore({
    // ioredis .call() signature differs slightly from rate-limit-redis's SendCommandFn;
    // cast to `any` here to bridge the gap without a custom wrapper.
    sendCommand: ((...args: string[]) => (client as any).call(...args)) as any,
    prefix: `rl:${prefix}:`,
  });
}

/**
 * Key by the email in the request body, falling back to IP when absent.
 *
 * Runs before `validate()`, so the body is parsed but not yet validated —
 * hence the defensive normalisation here.
 */
function makeEmailKey(req: Express.Request): string {
  const body = (req as any).body;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  return email.length > 0 ? `email:${email}` : `ip:${makeIpKey(req)}`;
}

function makeIpKey(req: Express.Request): string {
  // `trust proxy` is set on the app (index.ts), so req.ip is the REAL client IP:
  // Express ignores X-Forwarded-For entries injected beyond the trusted hop count.
  // The previous version read the *leftmost* X-Forwarded-For entry, which a client
  // can forge on every request to get a fresh bucket and bypass the limit entirely
  // (e.g. the login brute-force guard). ipKeyGenerator also normalizes IPv6 so a
  // client can't rotate within its /64 to evade the limit.
  return ipKeyGenerator((req as any).ip ?? "unknown");
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: makeIpKey,
  store: makeStore("login"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,   // Only count failures toward the limit
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: makeIpKey,
  store: makeStore("register"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many registrations from this IP. Please try again later." },
});

// The signup form calls this on a debounce as the user types, so the ceiling
// is well above the other auth limiters — but it is still capped, because the
// endpoint confirms whether an email is registered and would otherwise be a
// cheap way to enumerate accounts.
export const checkEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: makeIpKey,
  store: makeStore("check-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please try again shortly." },
});

export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: makeIpKey,
  store: makeStore("pwd-reset"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many password reset requests. Please try again in an hour." },
});

/**
 * Verification attempts. Keyed by IP: submitting codes is a guessing attack, and
 * the thing being protected is the OTP itself rather than a person's inbox.
 *
 * This used to be a single `otpLimiter` shared with /resend-otp, so ten mistyped
 * codes consumed the entire resend budget too — the user then could not request
 * a working code, which reads as "the OTP never arrived".
 */
export const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: makeIpKey,
  store: makeStore("otp-verify"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts. Please request a new code in an hour.",
  },
});

/**
 * Resends, keyed by EMAIL — the budget belongs to the inbox being protected,
 * not to whatever IP the request happened to arrive from.
 */
export const resendOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: makeEmailKey,
  store: makeStore("otp-resend-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "You've requested several codes for this address. Please try again in an hour, or contact support.",
  },
});

/**
 * Anti-abuse companion to the above: stops one host cycling through many
 * addresses to use us as a mail cannon. Deliberately generous, because a shared
 * carrier NAT can legitimately produce a lot of signups.
 */
export const resendOtpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: makeIpKey,
  store: makeStore("otp-resend-ip"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests from this network. Please try again later." },
});

// ─── Per-account limiters ─────────────────────────────

export const loginAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: makeEmailKey,
  store: makeStore("login-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only failures count
  message: {
    success: false,
    message: "Too many failed sign-in attempts for this account. Please try again in an hour or reset your password.",
  },
});

export const verifyOtpAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: makeEmailKey,
  store: makeStore("otp-verify-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many verification attempts for this account. Please request a new code in an hour.",
  },
});

export const forgotPasswordAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: makeEmailKey,
  store: makeStore("pwd-forgot-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Several reset codes have already been sent to this address. Please check your inbox or try again in an hour.",
  },
});

export const resetPasswordAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: makeEmailKey,
  store: makeStore("pwd-reset-email"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many password reset attempts for this account. Please try again in an hour.",
  },
});

export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  keyGenerator: makeIpKey,
  store: makeStore("global"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down." },
  skip: (req) => req.path === "/health",
});

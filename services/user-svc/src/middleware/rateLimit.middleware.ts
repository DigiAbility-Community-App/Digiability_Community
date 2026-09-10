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
//   /verify-email     — 10 per hour
//   /resend-otp       — 5 per hour
//   Global API        — 200 per min   (all other routes)
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

export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: makeIpKey,
  store: makeStore("otp"),
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, message: "Too many OTP requests. Please try again in an hour." },
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

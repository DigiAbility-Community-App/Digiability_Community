// ─────────────────────────────────────────────────────────────
// Environment Configuration
// Validates and exports all required env vars at startup.
// Fails fast if anything critical is missing.
// ─────────────────────────────────────────────────────────────

import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  // Server
  PORT: parseInt(optional("PORT", "4002"), 10),
  NODE_ENV: optional("NODE_ENV", "development"),
  SERVER_ID: optional("SERVER_ID", `chat-svc-${process.pid}`),

  // Database
  DATABASE_URL: required("DATABASE_URL"),

  // Redis
  REDIS_URL: required("REDIS_URL"),

  // JWT (public key only — we only verify, never sign)
  JWT_PUBLIC_KEY: required("JWT_PUBLIC_KEY").replace(/\\n/g, "\n"),

  // Client
  CLIENT_BASE_URL: optional("CLIENT_BASE_URL", "http://localhost:3000"),

  // Registry
  REGISTRY_TTL_SECONDS: parseInt(optional("REGISTRY_TTL_SECONDS", "120"), 10),
  HEARTBEAT_INTERVAL_MS: parseInt(optional("HEARTBEAT_INTERVAL_MS", "30000"), 10),

  // Derived
  get IS_PRODUCTION(): boolean {
    return this.NODE_ENV === "production";
  },
} as const;

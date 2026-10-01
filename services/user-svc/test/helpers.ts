import "dotenv/config";
import { generateKeyPairSync } from "crypto";
import express from "express";
import cookieParser from "cookie-parser";

import authRoutes from "../src/routes/auth.routes";
import profileRoutes from "../src/routes/profile.routes";
import privacyRoutes from "../src/routes/privacy.routes";
import { errorHandler } from "../src/middleware/error.middleware";
import { getRedis } from "../src/config/redis";

// Throwaway signing keys — the JWT util reads them at call time.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
process.env.JWT_PRIVATE_KEY = privateKey;
process.env.JWT_PUBLIC_KEY = publicKey;

/** The auth + profile routes as mounted in src/index.ts, without the server. */
export function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);
  app.use("/api/auth/privacy", privacyRoutes);
  app.use("/api/users/profile", profileRoutes);
  app.use(errorHandler);
  return app;
}

/**
 * Clear rate-limit counters (rl:*) in the local test Redis. Limits are per IP
 * per hour, so without this, repeated local runs trip them and fail tests
 * that have nothing to do with rate limiting.
 */
export async function resetRateLimits(): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) await redis.del(...keys);
}

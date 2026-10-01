import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp, resetRateLimits } from "./helpers";
import prisma from "../src/models/prisma.client";
import { disconnectRedis } from "../src/config/redis";
import { hashPassword } from "../src/utils/hash.util";
import { createPasswordResetOtp } from "../src/services/token.service";
import { signAccessToken } from "../src/utils/jwt.util";
import { createSessionCache, durationToSeconds } from "../src/utils/session-cache";
import { parseAllowedOrigins } from "../src/config/cors";

// ─────────────────────────────────────────────────────
// Session revocation (VAPT M-003 / CWE-613)
//
// Integration test against the local docker Postgres + Redis, through the
// real login / refresh / logout routes. Seeds its own user and removes it.
// ─────────────────────────────────────────────────────

const app = buildTestApp();
// ≤16 chars: the admin password policy currently caps password length at 16.
const PASSWORD = "Corr3ct-Horse-9!";
const NEW_PASSWORD = "N3w-Passw0rd!xyz";
let userId = "";
let email = "";

interface Login {
  accessToken: string;
  refreshToken: string;
}

async function login(password = PASSWORD): Promise<Login> {
  const res = await request(app)
    .post("/api/auth/login")
    .set("User-Agent", "vitest")
    .send({ email, password });
  expect(res.status).toBe(200);
  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.headers["x-refresh-token"] as string,
  };
}

const me = (token: string) => request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
const profile = (token: string) =>
  request(app).get("/api/users/profile/me").set("Authorization", `Bearer ${token}`);
const refresh = (refreshToken: string) =>
  request(app).post("/api/auth/refresh").set("Authorization", `Bearer ${refreshToken}`);

beforeAll(async () => {
  await resetRateLimits();
  email = `session-test-${randomUUID()}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: "Session Test",
      email,
      password: await hashPassword(PASSWORD),
      isEmailVerified: true,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
  await disconnectRedis();
});

describe("logout revokes the session", () => {
  it("captured token → logout → the same token is rejected immediately", async () => {
    const { accessToken } = await login();

    expect((await me(accessToken)).status).toBe(200);
    expect((await profile(accessToken)).status).not.toBe(401);

    const out = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${accessToken}`);
    expect(out.status).toBe(200);

    expect((await profile(accessToken)).status).toBe(401);
    expect((await me(accessToken)).status).toBe(401);
  });

  it("also kills the refresh token", async () => {
    const { accessToken, refreshToken } = await login();
    await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${accessToken}`);
    expect((await refresh(refreshToken)).status).toBe(401);
  });

  it("works with only the refresh token (access token gone or expired)", async () => {
    const { accessToken, refreshToken } = await login();
    const out = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(out.status).toBe(200);
    expect((await me(accessToken)).status).toBe(401);
  });

  it("returns 200 for unknown tokens without revealing anything", async () => {
    const out = await request(app).post("/api/auth/logout").send({ refreshToken: "nope" });
    expect(out.status).toBe(200);
  });
});

describe("logout-all", () => {
  it("revokes every session the user has", async () => {
    const phone = await login();
    const laptop = await login();

    const out = await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${phone.accessToken}`);
    expect(out.status).toBe(200);
    expect(out.body.data.sessionsEnded).toBeGreaterThanOrEqual(2);

    expect((await me(phone.accessToken)).status).toBe(401);
    expect((await me(laptop.accessToken)).status).toBe(401);
    expect((await refresh(laptop.refreshToken)).status).toBe(401);
  });

  it("requires authentication", async () => {
    expect((await request(app).post("/api/auth/logout-all")).status).toBe(401);
  });
});

describe("refresh rotation and reuse detection", () => {
  it("rotates the refresh token on every use, keeping the same session", async () => {
    const first = await login();
    const res = await refresh(first.refreshToken);
    expect(res.status).toBe(200);

    const rotated = res.headers["x-refresh-token"] as string;
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(first.refreshToken);

    const sidBefore = (jwt.decode(first.accessToken) as { sid: string }).sid;
    const sidAfter = (jwt.decode(res.body.data.accessToken) as { sid: string }).sid;
    expect(sidAfter).toBe(sidBefore);
    expect((await me(res.body.data.accessToken)).status).toBe(200);
  });

  it("replaying a used refresh token revokes the whole session", async () => {
    const first = await login();
    const res = await refresh(first.refreshToken);
    const latestAccess = res.body.data.accessToken as string;
    const latestRefresh = res.headers["x-refresh-token"] as string;

    // Attacker replays the old token
    expect((await refresh(first.refreshToken)).status).toBe(401);

    // ...and the legitimate holder's newer tokens are dead too
    expect((await me(latestAccess)).status).toBe(401);
    expect((await refresh(latestRefresh)).status).toBe(401);

    const session = await prisma.session.findUnique({
      where: { id: (jwt.decode(latestAccess) as { sid: string }).sid },
    });
    expect(session?.revokedReason).toBe("reuse_detected");
  });
});

describe("password reset", () => {
  it("revokes all sessions", async () => {
    const before = await login();
    const otp = await createPasswordResetOtp(userId);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ email, otp, password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    expect((await me(before.accessToken)).status).toBe(401);
    expect((await refresh(before.refreshToken)).status).toBe(401);

    // Restore the original password for any later test
    await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(PASSWORD) } });
  });
});

describe("access tokens", () => {
  it("are rejected without a session id", async () => {
    const legacy = signAccessToken({ sub: userId, email } as never);
    expect((await me(legacy)).status).toBe(401);
  });

  it("live 10 minutes and carry sid + jti", async () => {
    const { accessToken } = await login();
    const claims = jwt.decode(accessToken) as { iat: number; exp: number; sid?: string; jti?: string };
    expect(claims.exp - claims.iat).toBe(600);
    expect(claims.sid).toBeTruthy();
    expect(claims.jti).toBeTruthy();
  });
});

describe("session cache", () => {
  const brokenRedis = {
    get: () => Promise.reject(new Error("redis down")),
    set: () => Promise.reject(new Error("redis down")),
  };

  it("falls back to the database when Redis fails — never fails open", async () => {
    const revoked = createSessionCache({
      getRedis: () => brokenRedis,
      lookup: async () => false,
      activeTtlSeconds: 30,
      revokedTtlSeconds: 660,
    });
    expect(await revoked.isSessionActive("sid-1")).toBe(false);

    const active = createSessionCache({
      getRedis: () => brokenRedis,
      lookup: async () => true,
      activeTtlSeconds: 30,
      revokedTtlSeconds: 660,
    });
    expect(await active.isSessionActive("sid-1")).toBe(true);
  });

  it("without Redis, a revocation in this process is seen immediately", async () => {
    let dbActive = true;
    const cache = createSessionCache({
      getRedis: () => null,
      lookup: async () => dbActive,
      activeTtlSeconds: 30,
      revokedTtlSeconds: 660,
    });
    expect(await cache.isSessionActive("sid-2")).toBe(true); // now cached as active
    dbActive = false;
    await cache.markSessionRevoked("sid-2");
    expect(await cache.isSessionActive("sid-2")).toBe(false);
  });

  it("parses token lifetimes", () => {
    expect(durationToSeconds("10m")).toBe(600);
    expect(durationToSeconds("1h")).toBe(3600);
    expect(durationToSeconds("900")).toBe(900);
  });
});

describe("CORS allowlist", () => {
  it("refuses to start in production when missing, '*', or a placeholder", () => {
    expect(() => parseAllowedOrigins(undefined, true)).toThrow(/not set/);
    expect(() => parseAllowedOrigins("CHANGE_ME", true)).toThrow();
    expect(() => parseAllowedOrigins("*", true)).toThrow(/exact origins/);
    expect(() => parseAllowedOrigins("http://community.digiability.in", true)).toThrow(/https/);
    expect(() => parseAllowedOrigins("https://community.digiability.in/app", true)).toThrow(/bare https/);
  });

  it("accepts an explicit https allowlist", () => {
    expect(
      parseAllowedOrigins("https://community.digiability.in, https://admin.community.digiability.in/", true)
    ).toEqual(["https://community.digiability.in", "https://admin.community.digiability.in"]);
  });

  it("uses local defaults outside production", () => {
    expect(parseAllowedOrigins(undefined, false)).toContain("http://localhost:3000");
  });
});

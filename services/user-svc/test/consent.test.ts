import { randomUUID } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp, resetRateLimits } from "./helpers";
import prisma from "../src/models/prisma.client";
import { disconnectRedis } from "../src/config/redis";
import { createSession } from "../src/services/token.service";
import { recordRegistrationConsents } from "../src/services/consent.service";
import { POLICY_VERSION, CONSENT_NOTICE_VERSION } from "../src/config/policy-version.generated";

// ─────────────────────────────────────────────────────
// Data-processing consent (DPDP §5/§6)
//
// Registration needs a separate, explicit acceptedDataProcessing for the
// notice version actually shown; the consent row is stamped with that notice
// version; accounts whose consent predates the notice are asked again.
// ─────────────────────────────────────────────────────

const app = buildTestApp();
const createdUserIds: string[] = [];

function validRegistration(overrides: Record<string, unknown> = {}) {
  return {
    name: "Consent Test",
    email: `consent-test-${randomUUID()}@test.local`,
    password: "Corr3ct-Horse-9!",
    phoneNo: "9876543210",
    dateOfBirth: "1990-01-01",
    acceptedTerms: true,
    policyVersion: POLICY_VERSION,
    acceptedDataProcessing: true,
    consentNoticeVersion: CONSENT_NOTICE_VERSION,
    ...overrides,
  };
}

async function createUser(): Promise<{ id: string; email: string }> {
  const user = await prisma.user.create({
    data: {
      name: "Consent Test",
      email: `consent-test-${randomUUID()}@test.local`,
      password: "not-a-real-hash",
      isEmailVerified: true,
      dateOfBirth: new Date("1990-01-01"),
    },
  });
  createdUserIds.push(user.id);
  return user;
}

beforeAll(async () => {
  await resetRateLimits();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
  await disconnectRedis();
});

describe("registration requires separate data-processing consent", () => {
  it("rejects a signup that only accepted the Terms (422)", async () => {
    const body = validRegistration();
    delete (body as Record<string, unknown>).acceptedDataProcessing;
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body.errors)).toContain("acceptedDataProcessing");
  });

  it("rejects acceptedDataProcessing=false (422)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegistration({ acceptedDataProcessing: false }));
    expect(res.status).toBe(422);
  });

  it("rejects consent to an out-of-date notice (409)", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send(validRegistration({ consentNoticeVersion: "2000-01-01" }));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/data-processing notice/i);
  });
});

describe("consent records", () => {
  it("stamps DATA_PROCESSING with the notice version and a timestamp, Terms with the policy version", async () => {
    const user = await createUser();
    const before = Date.now();
    await recordRegistrationConsents(user.id, "203.0.113.77");

    const rows = await prisma.userConsent.findMany({ where: { userId: user.id } });
    const byType = Object.fromEntries(rows.map((r) => [r.consentType, r]));

    expect(byType.DATA_PROCESSING.version).toBe(CONSENT_NOTICE_VERSION);
    expect(byType.DATA_PROCESSING.accepted).toBe(true);
    expect(byType.DATA_PROCESSING.acceptedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(byType.DATA_PROCESSING.ipAddress).toBe("203.0.113.0"); // truncated
    expect(byType.TERMS_OF_USE.version).toBe(POLICY_VERSION);
  });
});

describe("existing users are asked to consent to the notice once", () => {
  it("dataConsentRequired until DATA_PROCESSING is accepted at the current notice version", async () => {
    const user = await createUser();
    // Simulates an account from before the separate notice: bundled consent
    // stamped with the policy version.
    await prisma.userConsent.createMany({
      data: [
        { userId: user.id, consentType: "DATA_PROCESSING", accepted: true, version: POLICY_VERSION, acceptedAt: new Date() },
        { userId: user.id, consentType: "TERMS_OF_USE", accepted: true, version: POLICY_VERSION, acceptedAt: new Date() },
        { userId: user.id, consentType: "COMMUNITY_GUIDELINES", accepted: true, version: POLICY_VERSION, acceptedAt: new Date() },
      ],
    });
    const { accessToken } = await createSession(user, "vitest");
    const me = () => request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    const first = await me();
    expect(first.status).toBe(200);
    expect(first.body.data.user.dataConsentRequired).toBe(true);
    expect(first.body.data.user.policyReacceptanceRequired).toBe(false);

    const consent = await request(app)
      .post("/api/auth/privacy/consent")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ consentType: "DATA_PROCESSING", accepted: true });
    expect(consent.status).toBe(200);

    const after = await me();
    expect(after.body.data.user.dataConsentRequired).toBe(false);

    const row = await prisma.userConsent.findUnique({
      where: { userId_consentType: { userId: user.id, consentType: "DATA_PROCESSING" } },
    });
    expect(row?.version).toBe(CONSENT_NOTICE_VERSION);
  });

  it("a brand-new account with no consent at all is also required to consent", async () => {
    const user = await createUser();
    const { accessToken } = await createSession(user, "vitest");
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.body.data.user.dataConsentRequired).toBe(true);
  });
});

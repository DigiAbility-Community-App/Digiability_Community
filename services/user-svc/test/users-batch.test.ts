import { randomUUID } from "crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildTestApp } from "./helpers";
import prisma from "../src/models/prisma.client";
import { disconnectRedis } from "../src/config/redis";
import { createSession } from "../src/services/token.service";

// ─────────────────────────────────────────────────────
// POST /api/auth/users/batch — object-level authorisation (VAPT M-002)
//
// Integration test against the local docker Postgres + Redis
// (`docker compose up -d postgres redis`). The `chat` schema must exist
// (`cd services/chat-svc && npx prisma db push`). Seeds its own rows and
// removes them afterwards.
// ─────────────────────────────────────────────────────

const app = buildTestApp();

type Seeded = Record<"A" | "B" | "C" | "F" | "D" | "I" | "J" | "V" | "Z" | "W", string>;
const u = {} as Seeded;
const convIds: string[] = [];
let tokenA = "";

async function createUser(label: string, deleted = false): Promise<string> {
  const user = await prisma.user.create({
    data: {
      name: `Batch Test ${label}`,
      email: `batch-test-${randomUUID()}@test.local`,
      password: "not-a-real-hash",
      ...(deleted ? { deletedAt: new Date() } : {}),
    },
  });
  return user.id;
}

async function createConversation(deleted = false): Promise<string> {
  const id = randomUUID();
  convIds.push(id);
  await prisma.$executeRaw`
    INSERT INTO chat.conversations (id, type, "createdBy", "updatedAt", "deletedAt")
    VALUES (${id}, 'GROUP'::chat."ConversationType", ${u.A}, now(), ${deleted ? new Date() : null})
  `;
  return id;
}

async function addMember(
  conversationId: string,
  userId: string,
  { left = false, role = "MEMBER" }: { left?: boolean; role?: string } = {}
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO chat.conversation_members (id, "conversationId", "userId", role, "updatedAt", "leftAt")
    VALUES (${randomUUID()}, ${conversationId}, ${userId}, ${role}::chat."MemberRole", now(), ${left ? new Date() : null})
  `;
}

async function addInvite(conversationId: string, inviterId: string, inviteeId: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO chat.group_invites (id, "conversationId", "inviterId", "inviteeId", "expiresAt", "updatedAt")
    VALUES (${randomUUID()}, ${conversationId}, ${inviterId}, ${inviteeId}, now() + interval '7 days', now())
  `;
}

function lookup(ids: unknown, token: string | null = tokenA) {
  const req = request(app).post("/api/auth/users/batch").send({ ids });
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
}

async function lookupIds(ids: string[]): Promise<string[]> {
  const res = await lookup(ids);
  expect(res.status).toBe(200);
  return (res.body.data.users as { id: string }[]).map((x) => x.id).sort();
}

beforeAll(async () => {
  u.A = await createUser("A requester");
  u.B = await createUser("B unrelated");
  u.C = await createUser("C co-member");
  u.F = await createUser("F former member");
  u.D = await createUser("D deleted co-member", true);
  u.I = await createUser("I invitee");
  u.J = await createUser("J invitee to a group A is only a member of");
  u.V = await createUser("V inviter of A");
  u.Z = await createUser("Z in a group A left");
  u.W = await createUser("W in a deleted group");

  // Group A is active in: C active, F left, D (deleted account) active.
  const shared = await createConversation();
  await addMember(shared, u.A);
  await addMember(shared, u.C);
  await addMember(shared, u.F, { left: true });
  await addMember(shared, u.D);

  // Group A administers, with a pending invite for I.
  const adminOf = await createConversation();
  await addMember(adminOf, u.A, { role: "OWNER" });
  await addInvite(adminOf, u.A, u.I);

  // Group A is a plain member of, with an invite for J — only admins see
  // the invite list, so J stays hidden.
  const memberOf = await createConversation();
  await addMember(memberOf, u.A);
  await addMember(memberOf, u.C, { role: "OWNER" });
  await addInvite(memberOf, u.C, u.J);

  // Group A is NOT in; V invited A to it.
  const invitedTo = await createConversation();
  await addMember(invitedTo, u.V);
  await addInvite(invitedTo, u.V, u.A);

  // Group A has left — its members are no longer visible to A.
  const left = await createConversation();
  await addMember(left, u.A, { left: true });
  await addMember(left, u.Z);

  // Soft-deleted group — its members are not visible either.
  const deleted = await createConversation(true);
  await addMember(deleted, u.A);
  await addMember(deleted, u.W);

  ({ accessToken: tokenA } = await createSession({ id: u.A, email: "a@test.local" }, "vitest"));
});

afterAll(async () => {
  if (convIds.length > 0) {
    await prisma.$executeRaw`DELETE FROM chat.group_invites WHERE "conversationId" = ANY(${convIds}::text[])`;
    await prisma.$executeRaw`DELETE FROM chat.conversation_members WHERE "conversationId" = ANY(${convIds}::text[])`;
    await prisma.$executeRaw`DELETE FROM chat.conversations WHERE id = ANY(${convIds}::text[])`;
  }
  await prisma.user.deleteMany({ where: { id: { in: Object.values(u) } } });
  await prisma.$disconnect();
  await disconnectRedis();
});

describe("POST /api/auth/users/batch", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await lookup([u.C], null);
    expect(res.status).toBe(401);
  });

  it("omits an unrelated user", async () => {
    expect(await lookupIds([u.B])).toEqual([]);
  });

  it("returns a co-member as a minimal { id, name } DTO", async () => {
    const res = await lookup([u.C]);
    expect(res.status).toBe(200);
    expect(res.body.data.users).toEqual([{ id: u.C, name: "Batch Test C co-member" }]);
  });

  it("returns the requester themselves", async () => {
    expect(await lookupIds([u.A])).toEqual([u.A]);
  });

  it("returns a former member of a group the requester is in", async () => {
    expect(await lookupIds([u.F])).toEqual([u.F]);
  });

  it("returns an invitee to a group the requester administers", async () => {
    expect(await lookupIds([u.I])).toEqual([u.I]);
  });

  it("omits an invitee to a group where the requester is only a member", async () => {
    expect(await lookupIds([u.J])).toEqual([]);
  });

  it("returns whoever invited the requester", async () => {
    expect(await lookupIds([u.V])).toEqual([u.V]);
  });

  it("omits soft-deleted accounts, even co-members", async () => {
    expect(await lookupIds([u.D])).toEqual([]);
  });

  it("omits members of a group the requester has left", async () => {
    expect(await lookupIds([u.Z])).toEqual([]);
  });

  it("omits members of a soft-deleted group", async () => {
    expect(await lookupIds([u.W])).toEqual([]);
  });

  it("filters a mixed list down to exactly the visible users", async () => {
    const all = Object.values(u);
    expect(await lookupIds(all)).toEqual([u.A, u.C, u.F, u.I, u.V].sort());
  });

  it("deduplicates ids, case-insensitively", async () => {
    expect(await lookupIds([u.C, u.C, u.C.toUpperCase()])).toEqual([u.C]);
  });

  it("rejects more than 50 ids with 422", async () => {
    const ids = Array.from({ length: 51 }, () => randomUUID());
    expect((await lookup(ids)).status).toBe(422);
  });

  it("rejects non-UUID ids with 422", async () => {
    expect((await lookup([u.C, "not-a-uuid"])).status).toBe(422);
  });

  it("rejects an empty or missing ids array with 422", async () => {
    expect((await lookup([])).status).toBe(422);
    expect((await request(app).post("/api/auth/users/batch").set("Authorization", `Bearer ${tokenA}`).send({})).status).toBe(422);
  });
});

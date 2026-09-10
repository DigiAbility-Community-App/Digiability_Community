// ─────────────────────────────────────────────────────────────
// Seed Script: App Store Reviewer Demo Accounts
//
// Creates two linked accounts so a store reviewer can exercise Report and
// Block against a real target. A reviewer who cannot reach a feature records
// it as absent, so both accounts are seeded past every gate: email verified,
// profile complete, 18+ date of birth, and consents recorded at the current
// policy version (otherwise the re-acceptance gate blocks the app on launch).
//
// Seeds across two Postgres schemas:
//   public — users, profiles, consents, forum content (owned by user-svc)
//   chat   — conversation, members, messages (owned by chat-svc)
// The chat rows go in via raw SQL because chat-svc's tables are outside this
// service's Prisma client. Same physical database, same pattern chat-svc
// already uses to read public.users.
//
// Run: npm run db:seed-demo
//
// Password: set DEMO_PASSWORD in the environment. The dev fallback below is
// only for local use — unlike seed-bot.ts, no live credential is committed here.
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcryptjs";
import { POLICY_VERSION } from "../src/config/policy-version.generated";

const prisma = new PrismaClient();

const PASSWORD = process.env.DEMO_PASSWORD ?? "DemoReview@2026";

const R1 = {
  id: "00000000-0000-0000-0000-0000000000d1",
  email: "reviewer1@digiability.demo",
  name: "Asha Reviewer",
  dob: new Date("1994-04-12"),
};
const R2 = {
  id: "00000000-0000-0000-0000-0000000000d2",
  email: "reviewer2@digiability.demo",
  name: "Ravi Demo",
  dob: new Date("1990-11-03"),
};

const DM_ID = "00000000-0000-0000-0000-0000000000c1";
const CARE_CIRCLE_ID = "00000000-0000-0000-0000-0000000000c2";
const QUESTION_ID = "00000000-0000-0000-0000-0000000000f1";
const ANSWER_ID = "00000000-0000-0000-0000-0000000000f2";

async function seedUser(u: typeof R1, hashed: string) {
  const user = await prisma.user.upsert({
    where: { id: u.id },
    update: {
      name: u.name,
      email: u.email,
      password: hashed,
      dateOfBirth: u.dob,
      isEmailVerified: true,
      profileComplete: true,
      deletedAt: null,
      isSuspended: false,
      roles: ["pwd"],
    },
    create: {
      id: u.id,
      name: u.name,
      email: u.email,
      password: hashed,
      dateOfBirth: u.dob,
      isEmailVerified: true,
      profileComplete: true,
      roles: ["pwd"],
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: u.id },
    update: { fullName: u.name, city: "Pune", state: "Maharashtra" },
    create: { userId: u.id, fullName: u.name, city: "Pune", state: "Maharashtra" },
  });

  // Without these the app opens straight into the re-acceptance gate and the
  // reviewer never reaches the features they came to test.
  for (const consentType of [
    "DATA_PROCESSING",
    "TERMS_OF_USE",
    "COMMUNITY_GUIDELINES",
  ] as const) {
    await prisma.userConsent.upsert({
      where: { userId_consentType: { userId: u.id, consentType } },
      update: { accepted: true, version: POLICY_VERSION, acceptedAt: new Date(), withdrawnAt: null },
      create: {
        userId: u.id,
        consentType,
        accepted: true,
        version: POLICY_VERSION,
        acceptedAt: new Date(),
      },
    });
  }

  return user;
}

async function seedForumContent() {
  await prisma.forumQuestion.upsert({
    where: { id: QUESTION_ID },
    update: {},
    create: {
      id: QUESTION_ID,
      title: "Tips for making a home office more wheelchair accessible?",
      description:
        "I've recently started working from home and I'm looking for practical advice on desk height, doorway widths and storage that's reachable from a seated position. What worked for you?",
      category: "Accessibility",
      authorId: R2.id,
      answerCount: 1,
    },
  });

  await prisma.forumAnswer.upsert({
    where: { id: ANSWER_ID },
    update: {},
    create: {
      id: ANSWER_ID,
      content:
        "A height-adjustable desk made the biggest difference for me — worth the cost. Also consider a lazy-susan style organiser so everything is within arm's reach without twisting.",
      questionId: QUESTION_ID,
      authorId: R1.id,
    },
  });
}

// chat-svc owns the `chat` schema, so these go in as raw SQL.
async function seedChat() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO chat.conversations (id, type, "createdBy", "maxMembers", "createdAt", "updatedAt")
     VALUES ($1, 'DIRECT', $2, 2, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    DM_ID,
    R1.id
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO chat.conversations (id, type, "subType", name, description, "createdBy", "maxMembers", "createdAt", "updatedAt")
     VALUES ($1, 'GROUP', 'CARE_CIRCLE', 'Demo Care Circle', 'A sample Care Circle for review purposes.', $2, 15, NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    CARE_CIRCLE_ID,
    R1.id
  );

  const members: Array<[string, string, string]> = [
    [DM_ID, R1.id, "MEMBER"],
    [DM_ID, R2.id, "MEMBER"],
    [CARE_CIRCLE_ID, R1.id, "OWNER"],
    [CARE_CIRCLE_ID, R2.id, "MEMBER"],
  ];
  for (const [conversationId, userId, role] of members) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat.conversation_members (id, "conversationId", "userId", role, "joinedAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3::"chat"."MemberRole", NOW(), NOW())
       ON CONFLICT ("conversationId", "userId") DO NOTHING`,
      conversationId,
      userId,
      role
    );
  }

  // Messages from reviewer2 give the reviewer something concrete to report.
  const messages: Array<[string, string, number, string]> = [
    ["00000000-0000-0000-0000-0000000000m1", R2.id, 1, "Hi! Thanks for connecting on here."],
    ["00000000-0000-0000-0000-0000000000m2", R1.id, 2, "Happy to help — what are you working on?"],
    ["00000000-0000-0000-0000-0000000000m3", R2.id, 3, "Mostly looking for accessible workspace tips."],
  ];
  for (const [id, senderId, seq, content] of messages) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO chat.messages (id, "conversationId", "senderId", "clientMessageId", "sequenceNo", content, type, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'TEXT', 'PERSISTED', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      id,
      DM_ID,
      senderId,
      `demo-${id}`,
      seq,
      content
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE chat.conversations
        SET "lastMessageId" = $2, "lastMessageAt" = NOW(), "lastMessageText" = $3
      WHERE id = $1`,
    DM_ID,
    "00000000-0000-0000-0000-0000000000m3",
    "Mostly looking for accessible workspace tips."
  );
}

async function main() {
  console.log("🎬 Seeding app-store reviewer demo accounts...\n");

  const hashed = await bcrypt.hash(PASSWORD, 12);
  await seedUser(R1, hashed);
  await seedUser(R2, hashed);
  console.log("✅ Two verified, consented, 18+ accounts created.");

  await seedForumContent();
  console.log("✅ Forum question + answer seeded.");

  try {
    await seedChat();
    console.log("✅ DM conversation, Care Circle and messages seeded.");
  } catch (err) {
    // chat-svc may not have run its migrations yet on a fresh database. The
    // accounts are still usable, so report rather than abort.
    console.warn(
      "⚠️  Chat seeding skipped — is chat-svc's schema migrated? " +
        (err as Error).message
    );
  }

  console.log("\n🔑 Hand these to the store listing:\n");
  console.log(`   Account 1 (sign in as this one)`);
  console.log(`     Email:    ${R1.email}`);
  console.log(`     Password: ${PASSWORD}`);
  console.log(`   Account 2 (the target for Report and Block)`);
  console.log(`     Email:    ${R2.email}`);
  console.log(`     Password: ${PASSWORD}`);
  console.log("\n   What the reviewer can exercise:");
  console.log("     • Report a message in the DM with Asha ↔ Ravi");
  console.log("     • Report Ravi's profile from the chat header");
  console.log("     • Report the seeded forum question and answer");
  console.log("     • Block and then unblock Ravi (Profile → Blocked Users)");
  console.log("     • Delete the account (Profile → Privacy & Data)\n");

  if (!process.env.DEMO_PASSWORD) {
    console.warn("⚠️  DEMO_PASSWORD was not set — used the local dev fallback.");
    console.warn("   Set it before seeding anything reachable from the internet.\n");
  }
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

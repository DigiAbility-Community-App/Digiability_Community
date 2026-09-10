// ─────────────────────────────────────────────────────────────
// Seed Script: DigiAbility Admin forum identity
//
// Admin replies posted from the admin panel used to be attributed to the
// chat bot (00000000-…-0001, "Digiability Bot"), so an official reply showed
// up in the app as though the bot had written it. The panel papered over this
// by returning a fake authorName in the POST response, which meant the reply
// read "DigiAbility Admin" until the page was reloaded and then reverted.
//
// This is a separate identity so the two roles stop sharing one account: the
// bot stays the bot, and admin forum replies have a name of their own.
//
// Run: npx ts-node prisma/seed-admin-user.ts
//   or: npm run db:seed-admin
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

// Fixed uuid so the admin panel can reference it without a lookup — the
// sibling of the bot's …0001.
const ADMIN_USER_ID = "00000000-0000-0000-0000-000000000002";
const ADMIN_EMAIL = "admin@digiability.com";
const ADMIN_NAME = "DigiAbility Admin";

async function main() {
  console.log("🛡️  Seeding DigiAbility Admin forum identity...\n");

  // This account exists to own forum replies, not to be logged into. Give it
  // a random password rather than a known one: a shared, documented
  // credential for a privileged-looking account is a liability, and nothing
  // needs to authenticate as it.
  const hashedPassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

  const admin = await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    update: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      isEmailVerified: true,
    },
    // Password is only set on create, so re-running this never invalidates
    // an existing row.
    create: {
      id: ADMIN_USER_ID,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashedPassword,
      isEmailVerified: true,
      profileComplete: true,
    },
  });

  console.log("✅ Admin forum identity created/updated:");
  console.log(`   ID:    ${admin.id}`);
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log("");
  console.log("Admin forum replies will now be attributed to this account.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

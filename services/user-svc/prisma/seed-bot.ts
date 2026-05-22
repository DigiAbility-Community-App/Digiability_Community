// ─────────────────────────────────────────────────────────────
// Seed Script: Digiability Bot User
//
// Creates a global bot user that appears in every user's
// conversation list. Has real login credentials for testing.
//
// Run: npx ts-node prisma/seed-bot.ts
//   or: npm run db:seed-bot
// ─────────────────────────────────────────────────────────────

import "dotenv/config";
import { PrismaClient } from "../src/generated/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BOT_USER_ID = "00000000-0000-0000-0000-000000000001";
const BOT_EMAIL = "bot@digiability.com";
const BOT_PASSWORD = "DigiBot@2024";
const BOT_NAME = "Digiability Bot";

async function main() {
  console.log("🤖 Seeding Digiability Bot user...\n");

  const hashedPassword = await bcrypt.hash(BOT_PASSWORD, 12);

  const bot = await prisma.user.upsert({
    where: { id: BOT_USER_ID },
    update: {
      name: BOT_NAME,
      email: BOT_EMAIL,
      password: hashedPassword,
      isEmailVerified: true,
    },
    create: {
      id: BOT_USER_ID,
      name: BOT_NAME,
      email: BOT_EMAIL,
      password: hashedPassword,
      isEmailVerified: true,
      profileComplete: true,
    },
  });

  console.log("✅ Bot user created/updated:");
  console.log(`   ID:       ${bot.id}`);
  console.log(`   Name:     ${bot.name}`);
  console.log(`   Email:    ${bot.email}`);
  console.log(`   Verified: ${bot.isEmailVerified}`);
  console.log("");
  console.log("🔑 Login credentials:");
  console.log(`   Email:    ${BOT_EMAIL}`);
  console.log(`   Password: ${BOT_PASSWORD}`);
  console.log("");
  console.log("Done! The bot will appear in users' conversation lists upon login.");
}

main()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

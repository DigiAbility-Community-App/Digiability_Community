import "dotenv/config";
import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🛠 Creating 'events' table manually in public schema...");

  const sql = `
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      location TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      image TEXT NOT NULL,
      description TEXT NOT NULL,
      spots INTEGER DEFAULT 50 NOT NULL,
      "buttonType" TEXT DEFAULT 'filled' NOT NULL,
      "externalUrl" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await prisma.$executeRawUnsafe(sql);
  console.log("✅ 'events' table created or already exists!");
}

main()
  .catch((err) => {
    console.error("❌ Failed to create table:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

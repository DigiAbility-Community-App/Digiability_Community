import { PrismaClient } from "../generated/client";

// ─────────────────────────────────────────────────────────────
// Prisma Client Singleton — chat-svc
// Prevents multiple instances during hot-reload in development.
// ─────────────────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __chatPrisma: PrismaClient | undefined;
}

const prisma: PrismaClient =
  global.__chatPrisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__chatPrisma = prisma;
}

export default prisma;

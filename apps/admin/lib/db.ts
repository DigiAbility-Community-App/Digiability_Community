import { Pool, types as pgTypes } from "pg";

// ─────────────────────────────────────────────────────────────
// Prisma stores its DateTime columns as `timestamp without time zone`
// holding UTC values (users."createdAt", "lastSeen", forum_questions, etc.).
// node-postgres parses that type by building a JS Date in the *server's*
// local timezone, so on a machine running IST every Prisma timestamp came
// back 5h30m earlier than the moment it actually represents — a user created
// at 22:27 IST rendered as 16:57, and anything near midnight showed the wrong
// day entirely. Re-parsing as UTC makes the Date a correct instant regardless
// of where the server runs.
//
// Only OID 1114 (`timestamp`) is affected. The admin panel's own tables use
// TIMESTAMPTZ (OID 1184), which pg already parses correctly — left untouched.
// ─────────────────────────────────────────────────────────────
const PG_TIMESTAMP_OID = 1114;
pgTypes.setTypeParser(PG_TIMESTAMP_OID, (value: string | null) => {
  if (value === null) return null;
  // "2026-09-08 16:57:54.796" -> "2026-09-08T16:57:54.796Z"
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`);
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

console.log(
  "[ADMIN DB]",
  connectionString.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1****$2")
);

export const dbPool = new Pool({ connectionString });

dbPool.on("connect", (client) => {
  client.query("SET search_path TO public, chat;").catch((err) => {
    console.error("Failed to set search_path on DB connection:", err);
  });
});
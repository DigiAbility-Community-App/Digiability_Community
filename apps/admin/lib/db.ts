import { Pool } from "pg";

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
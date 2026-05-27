import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://digiability:digiability_secret@localhost:5432/digiability_db?schema=public";

export const dbPool = new Pool({
  connectionString,
});

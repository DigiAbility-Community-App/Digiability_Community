import { dbPool } from "@/lib/db";

/**
 * Generates a category id like "EV0012026"/"SV0012026" — prefix + a
 * 3-digit sequence that resets each calendar year + the 4-digit year.
 * Counts existing rows for the given table created this year rather than
 * using a separate counter table; acceptable for this low-write-frequency,
 * hand-curated master data (not a high-concurrency path).
 */
export async function generateCategoryId(table: "event_categories" | "service_categories", prefix: "EV" | "SV"): Promise<string> {
  const year = new Date().getFullYear();
  const countRes = await dbPool.query(
    `SELECT COUNT(*)::int as count FROM ${table} WHERE EXTRACT(YEAR FROM created_at) = $1`,
    [year]
  );
  const nextSeq = (countRes.rows[0]?.count ?? 0) + 1;
  return `${prefix}${String(nextSeq).padStart(3, "0")}${year}`;
}

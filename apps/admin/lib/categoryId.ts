import { dbPool } from "@/lib/db";

const MAX_SEQ = 999;

/**
 * Generates a category id like "EV0012026"/"SV0012026" — prefix + a
 * 3-digit sequence that resets each calendar year + the 4-digit year.
 *
 * The sequence is derived from the highest sequence already used for this
 * prefix+year, NOT from a row count. Counting rows looks equivalent but
 * breaks as soon as anything is deleted: the count drops, so the next id
 * collides with an id that is still in use, the INSERT violates the primary
 * key, and (because the routes' ON CONFLICT only covers `name`) the whole
 * request 500s. Ids are therefore never reused, even after a delete.
 *
 * Callers should still be prepared for a unique violation — two concurrent
 * creates can pick the same candidate — and retry. This is low-frequency,
 * hand-curated master data, so a retry is cheaper than a counter table.
 */
export async function generateCategoryId(
  table: "event_categories" | "service_categories",
  prefix: "EV" | "SV"
): Promise<string> {
  const year = new Date().getFullYear();

  // Only ids matching this exact prefix+year shape carry a sequence we can
  // reason about. Rows seeded before this format existed (plain UUIDs) are
  // ignored here rather than renumbered — live services/events reference
  // them by id, so rewriting them would orphan those rows.
  const res = await dbPool.query(
    `SELECT COALESCE(MAX(SUBSTRING(id FROM 3 FOR 3)::int), 0) AS max_seq
       FROM ${table}
      WHERE id ~ ('^' || $1 || '[0-9]{3}' || $2 || '$')`,
    [prefix, String(year)]
  );

  const startSeq = (res.rows[0]?.max_seq ?? 0) + 1;

  // Walk forward past anything already taken. Normally exits on the first
  // iteration; the loop only matters if a non-conforming id happens to
  // occupy the candidate slot.
  for (let seq = startSeq; seq <= MAX_SEQ; seq++) {
    const candidate = `${prefix}${String(seq).padStart(3, "0")}${year}`;
    const taken = await dbPool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [candidate]);
    if (taken.rowCount === 0) return candidate;
  }

  throw new Error(
    `Exhausted ${prefix} category ids for ${year} (limit ${MAX_SEQ}). The id format needs widening.`
  );
}

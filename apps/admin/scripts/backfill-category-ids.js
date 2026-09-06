// One-time backfill: renumber event_categories/service_categories ids from
// random UUIDs to the new EV/SV + 3-digit-sequence-per-year + year format.
//
// ⚠️ DO NOT RUN THIS AGAIN. Its original assumption — that "category ids are
// never used as a foreign key anywhere else (events/services store category by
// free-text name)" — is NO LONGER TRUE. The services and events tables now
// store the category *id* in their `category` column, so renumbering ids here
// would orphan every service and event row that references an old id, leaving
// them unfilterable and showing a blank/raw category in both the app and the
// admin panel. This script is kept only as a historical record of that one-time
// id-format migration. If category ids ever genuinely need renumbering again,
// the referencing rows in `services` and `events` must be updated in the same
// transaction. See backfill-legacy-categories.js for the current, safe script
// that maps legacy free-text category values onto real master-data ids.
//
// Run with DATABASE_URL set in the environment, e.g.:
//   DATABASE_URL=postgresql://... node apps/admin/scripts/backfill-category-ids.js

const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function backfillTable(table, prefix) {
  const { rows } = await pool.query(
    `SELECT id, created_at FROM ${table} ORDER BY created_at ASC`
  );

  const seqByYear = new Map();
  const updates = [];
  for (const row of rows) {
    const year = new Date(row.created_at).getFullYear();
    const nextSeq = (seqByYear.get(year) || 0) + 1;
    seqByYear.set(year, nextSeq);
    const newId = `${prefix}${String(nextSeq).padStart(3, "0")}${year}`;
    updates.push({ oldId: row.id, newId });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { oldId, newId } of updates) {
      await client.query(`UPDATE ${table} SET id = $1 WHERE id = $2`, [newId, oldId]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  console.log(`${table}: renumbered ${updates.length} row(s)`);
  for (const { oldId, newId } of updates) {
    console.log(`  ${oldId}  ->  ${newId}`);
  }
}

async function main() {
  await backfillTable("event_categories", "EV");
  await backfillTable("service_categories", "SV");
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

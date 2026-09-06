// One-time backfill: links legacy free-text `category` values on the
// `services` and `events` tables to real service_categories/event_categories
// ids, so mobile category filtering (exact id equality — see
// ServicesScreen.tsx/EventsScreen.tsx) works for rows created before that
// id-linkage fix shipped. Historically `category` stored things like
// "therapists", "equipment", "Legal Aid", etc. — plain text typed or picked
// off a hardcoded list, never a service_categories/event_categories id.
//
// For each row this script:
//   1. Skips it if `category` already equals a real category id (idempotent
//      — safe to run more than once; a second run is a no-op).
//   2. Otherwise tries to match `category` (case-insensitively) against an
//      existing category NAME and uses that category's id.
//   3. Otherwise, for the five known legacy service slugs
//      ("therapists"/"equipment"/"care"/"legal"/"transport"), maps to the
//      canonical name those slugs meant and resolves/creates that category.
//   4. Otherwise creates a brand-new category using the raw text as its
//      name, so no row's category is ever silently dropped or blanked.
//
// SAFETY: this script is meant to be reviewed and run manually. It is NOT
// executed automatically by anything else in this repo. It only touches the
// `services`/`events` tables and `service_categories`/`event_categories`
// (creating the latter two if they don't exist yet, matching the schema
// apps/admin/lib/masterCategories.ts already creates them with). All writes
// for a given table run inside one transaction.
//
// Usage:
//   DATABASE_URL=postgresql://... node apps/admin/scripts/backfill-legacy-categories.js --dry-run
//   DATABASE_URL=postgresql://... node apps/admin/scripts/backfill-legacy-categories.js
//
// Always run with --dry-run first and review the printed plan before
// running for real.

const { Pool } = require("pg");

const DRY_RUN = process.argv.includes("--dry-run");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL environment variable is required");
  process.exit(1);
}

const pool = new Pool({ connectionString });

// Legacy service category slugs (from the old hardcoded BASE_CATEGORIES /
// SERVICE_CATEGORIES lists and the original seed data) mapped to the
// canonical master-data name they were always meant to represent. Matched
// case-insensitively. Events never had a separate slug form — their legacy
// values were already real category display names — so no map is needed
// there; case-insensitive name matching (step 2 above) covers them.
const SERVICE_LEGACY_NAME_MAP = {
  therapists: "Therapists",
  equipment: "Equipment Vendor",
  care: "Respite Care",
  legal: "Legal Services",
  transport: "Transportation",
};

const EVENT_LEGACY_NAME_MAP = {};

async function tableExists(client, table) {
  const res = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
  return res.rows[0].reg !== null;
}

async function ensureCategoryTable(client, table) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

/** Mirrors apps/admin/lib/categoryId.ts's id format (PREFIX + 3-digit
 *  per-year sequence + year, e.g. "SV0012026") without importing TS into
 *  this plain Node script. `usedIds` must contain every id already in the
 *  category table plus every id generated earlier in this run. */
function generateCategoryId(usedIds, prefix, year) {
  let seq = 1;
  let id;
  do {
    id = `${prefix}${String(seq).padStart(3, "0")}${year}`;
    seq += 1;
  } while (usedIds.has(id));
  return id;
}

async function backfillCategoryColumn(client, { dataTable, categoryTable, idPrefix, legacyNameMap }) {
  if (!(await tableExists(client, dataTable))) {
    console.log(`\n[${dataTable}] Table does not exist yet — nothing to backfill.`);
    return;
  }

  await ensureCategoryTable(client, categoryTable);

  const { rows: categories } = await client.query(`SELECT id, name FROM ${categoryTable}`);
  const usedIds = new Set(categories.map((c) => c.id));
  const nameToId = new Map(categories.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const { rows: dataRows } = await client.query(`SELECT id, category FROM ${dataTable}`);

  const updates = [];
  const creations = [];
  const currentYear = new Date().getFullYear();

  for (const row of dataRows) {
    const raw = (row.category || "").trim();
    if (!raw) continue;
    if (usedIds.has(raw)) continue; // already a real category id — idempotent skip

    const targetName = legacyNameMap[raw.toLowerCase()] || raw;
    const nameKey = targetName.trim().toLowerCase();
    let targetId = nameToId.get(nameKey);

    if (!targetId) {
      targetId = generateCategoryId(usedIds, idPrefix, currentYear);
      usedIds.add(targetId);
      nameToId.set(nameKey, targetId);
      creations.push({ id: targetId, name: targetName });
    }

    updates.push({ rowId: row.id, oldCategory: raw, newCategoryId: targetId, newCategoryName: targetName });
  }

  console.log(`\n[${dataTable}] ${dataRows.length} row(s) scanned, ${updates.length} need linking to ${categoryTable}.`);

  if (creations.length > 0) {
    console.log(`[${dataTable}] Will create ${creations.length} new ${categoryTable} row(s):`);
    for (const c of creations) console.log(`  + ${c.id}  "${c.name}"`);
  }
  for (const u of updates) {
    console.log(`  ${dataTable}.id=${u.rowId}: "${u.oldCategory}" -> ${u.newCategoryId} ("${u.newCategoryName}")`);
  }

  if (updates.length === 0) {
    console.log(`[${dataTable}] Nothing to do — every row already links to a real category id.`);
    return;
  }

  if (DRY_RUN) {
    console.log(`[${dataTable}] Dry run — no changes written.`);
    return;
  }

  await client.query("BEGIN");
  try {
    for (const c of creations) {
      await client.query(
        `INSERT INTO ${categoryTable} (id, name, status) VALUES ($1, $2, 'Active') ON CONFLICT (id) DO NOTHING`,
        [c.id, c.name]
      );
    }
    for (const u of updates) {
      await client.query(`UPDATE ${dataTable} SET category = $1 WHERE id = $2`, [u.newCategoryId, u.rowId]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }

  console.log(
    `[${dataTable}] Done — ${updates.length} row(s) updated, ${creations.length} categor${creations.length === 1 ? "y" : "ies"} created.`
  );
}

async function main() {
  console.log(`Backfilling legacy service/event category text -> master data ids${DRY_RUN ? "  (DRY RUN — no writes)" : ""}`);

  const client = await pool.connect();
  try {
    await backfillCategoryColumn(client, {
      dataTable: "services",
      categoryTable: "service_categories",
      idPrefix: "SV",
      legacyNameMap: SERVICE_LEGACY_NAME_MAP,
    });
    await backfillCategoryColumn(client, {
      dataTable: "events",
      categoryTable: "event_categories",
      idPrefix: "EV",
      legacyNameMap: EVENT_LEGACY_NAME_MAP,
    });
  } finally {
    client.release();
  }

  await pool.end();
  console.log("\nBackfill complete." + (DRY_RUN ? " Re-run without --dry-run to apply." : ""));
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});

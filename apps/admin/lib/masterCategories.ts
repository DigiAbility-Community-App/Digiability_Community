import { dbPool } from "@/lib/db";
import { generateCategoryId } from "@/lib/categoryId";

// Shared table bootstrap + default-name seed logic for the two Master Data
// category tables. Factored out of app/api/settings/service-categories and
// event-categories route.ts so app/api/services and app/api/events can also
// ensure these tables exist and look up/create a category id by name — e.g.
// to link their own hardcoded seed rows to real master data instead of
// storing free-text category values (see services/route.ts's defaultServices
// seed).
async function ensureCategoryTable(table: "service_categories" | "event_categories", defaults: string[]) {
  // Whether the table already existed BEFORE this call decides if we seed.
  // This must be checked first: seeding on "table is empty" instead means an
  // admin who deletes every category gets them all recreated by the very next
  // request (including the POST that adds their replacement, which runs this
  // first and so resurrects the defaults alongside it). An empty category
  // list is a legitimate state an admin chose, not a state to repair.
  const existed = await dbPool.query(`SELECT to_regclass($1) AS oid`, [table]);
  const isFirstCreation = existed.rows[0]?.oid === null;

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  if (!isFirstCreation) return;

  // Seed through generateCategoryId so a fresh install gets the same
  // SV…/EV… ids the admin UI produces, rather than the UUIDs the column
  // default would hand out.
  const prefix = table === "service_categories" ? "SV" : "EV";
  for (const name of defaults) {
    const id = await generateCategoryId(table, prefix);
    await dbPool.query(
      `INSERT INTO ${table} (id, name, status) VALUES ($1, $2, 'Active') ON CONFLICT DO NOTHING`,
      [id, name]
    );
  }
}

const SERVICE_CATEGORY_DEFAULTS = [
  "Therapists",
  "Equipment Vendor",
  "Respite Care",
  "Legal Services",
  "Transportation",
  "Medical Support",
  "Accessibility Aids",
];

const EVENT_CATEGORY_DEFAULTS = [
  "Medical Support",
  "Legal Aid",
  "Skill Training",
  "Assistive Technology",
  "General Support",
  "Awareness",
];

export async function ensureServiceCategoriesTable() {
  await ensureCategoryTable("service_categories", SERVICE_CATEGORY_DEFAULTS);
}

export async function ensureEventCategoriesTable() {
  await ensureCategoryTable("event_categories", EVENT_CATEGORY_DEFAULTS);
}

async function getOrCreateCategoryId(
  table: "service_categories" | "event_categories",
  prefix: "SV" | "EV",
  name: string
): Promise<string> {
  const existing = await dbPool.query(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  if (existing.rows.length > 0) return existing.rows[0].id;

  const id = await generateCategoryId(table, prefix);
  await dbPool.query(
    `INSERT INTO ${table} (id, name, status) VALUES ($1, $2, 'Active') ON CONFLICT (name) DO UPDATE SET status = 'Active'`,
    [id, name]
  );
  const row = await dbPool.query(`SELECT id FROM ${table} WHERE name = $1`, [name]);
  return row.rows[0].id;
}

/** Looks up a service category's id by exact name; creates it (with a
 *  generated SV… id) if it doesn't exist yet. Ensures the table first. */
export async function getOrCreateServiceCategoryId(name: string): Promise<string> {
  await ensureServiceCategoriesTable();
  return getOrCreateCategoryId("service_categories", "SV", name);
}

/** Looks up an event category's id by exact name; creates it (with a
 *  generated EV… id) if it doesn't exist yet. Ensures the table first. */
export async function getOrCreateEventCategoryId(name: string): Promise<string> {
  await ensureEventCategoriesTable();
  return getOrCreateCategoryId("event_categories", "EV", name);
}

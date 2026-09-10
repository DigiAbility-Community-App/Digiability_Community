#!/usr/bin/env node
/**
 * check:safety — verify the crisis helpline numbers agree everywhere.
 *
 * These numbers exist in places that cannot import from each other:
 *   apps/mobile/src/constants/safetyResources.ts
 *   apps/web/src/utils/safetyResources.ts
 *   docs/legal/*.md  (published commitments — the Community Guidelines list the
 *                     crisis lines, the Child Safety Standards lists 1098)
 *
 * A wrong number here is not a broken feature, it is someone in crisis dialling
 * a line that does not answer. The app previously shipped the US lifeline (988)
 * to an India-only audience, presented as the "24/7 Crisis & Mental Health
 * Lifeline", which is exactly the failure this check exists to prevent.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MOBILE = path.join(ROOT, "apps/mobile/src/constants/safetyResources.ts");
const WEB = path.join(ROOT, "apps/web/src/utils/safetyResources.ts");
const LEGAL_DIR = path.join(ROOT, "docs/legal");

/** Every published legal document, as one digits-only blob for lookup. */
function publishedDigits() {
  return fs
    .readdirSync(LEGAL_DIR)
    .filter((f) => f.endsWith(".md") && f !== "HOLD-unpublished-sections.md")
    .map((f) => fs.readFileSync(path.join(LEGAL_DIR, f), "utf8"))
    .join("\n")
    .replace(/[\s\-–—]/g, "");
}

/** Pull `phone: "..."` values, paired with the preceding `name: "..."`. */
function extractResources(file) {
  const src = fs.readFileSync(file, "utf8");
  const out = [];
  const re = /name:\s*"([^"]+)"[\s\S]*?phone:\s*"(\d+)"/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push({ name: m[1], phone: m[2] });
  return out;
}

function main() {
  const problems = [];

  for (const f of [MOBILE, WEB]) {
    if (!fs.existsSync(f)) {
      console.error(`check:safety — missing ${path.relative(ROOT, f)}`);
      process.exit(1);
    }
  }

  const mobile = extractResources(MOBILE);
  const web = extractResources(WEB);

  if (mobile.length === 0) {
    problems.push("no resources parsed from the mobile list — has its shape changed?");
  }

  // 1. The two client lists must match exactly.
  const key = (r) => `${r.name}|${r.phone}`;
  const mobileSet = new Set(mobile.map(key));
  const webSet = new Set(web.map(key));
  for (const k of mobileSet) {
    if (!webSet.has(k)) problems.push(`only in mobile: ${k.replace("|", " → ")}`);
  }
  for (const k of webSet) {
    if (!mobileSet.has(k)) problems.push(`only in web:    ${k.replace("|", " → ")}`);
  }

  // 2. Every number the app offers must appear somewhere in the published
  //    documents, ignoring the spacing and hyphens used for readability in
  //    prose. Otherwise the app is directing people somewhere we never
  //    committed to — or, worse, somewhere nobody has verified.
  const published = publishedDigits();
  for (const r of mobile) {
    if (!published.includes(r.phone)) {
      problems.push(
        `${r.name} (${r.phone}) is offered in the app but appears in no published legal document`
      );
    }
  }

  // 3. Nothing anywhere should still be pointing at the US crisis line.
  for (const f of [MOBILE, WEB]) {
    const src = fs.readFileSync(f, "utf8");
    if (/phone:\s*"988"/.test(src)) {
      problems.push(`${path.relative(ROOT, f)} still lists 988 — that is the US lifeline`);
    }
  }

  if (problems.length > 0) {
    console.error(`\ncheck:safety FAILED — ${problems.length} problem(s):\n`);
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      "\nCrisis numbers must agree across both clients and the published Community Guidelines.\n"
    );
    process.exit(1);
  }

  console.log(
    `check:safety passed — ${mobile.length} helplines agree across mobile, web and the published documents.`
  );
}

main();

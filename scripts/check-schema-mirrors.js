#!/usr/bin/env node
/**
 * check:schema-mirrors — fail if user-svc and forum-svc disagree about the
 * shared `public` Postgres schema.
 *
 * Both services point Prisma at the same physical schema, and `prisma db push`
 * does a full declarative reconciliation: anything present in the database but
 * absent from the file being pushed is DROPPED. So each file must declare the
 * other's tables as inert stub mirrors, field for field.
 *
 * This is not theoretical. Before this check existed, forum-svc's file was
 * missing twelve of user-svc's models and enums outright — including
 * UserConsent, the DPDP consent record store — and had a drifted AdminAuditLog.
 * A single `npm run forum-svc:push` would have dropped user_consents,
 * banned_keywords, moderation_flags and disability_types, and rewritten
 * admin_audit_log's columns.
 *
 * Compares field names and types, ignoring comments, ordering and formatting,
 * since stub mirrors legitimately trim the documentation comments.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILES = {
  "user-svc": path.join(ROOT, "services", "user-svc", "prisma", "schema.prisma"),
  "forum-svc": path.join(ROOT, "services", "forum-svc", "prisma", "schema.prisma"),
};

function parse(text) {
  const out = {};
  const re = /^(model|enum)\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, kind, name, body] = m;
    const fields = new Set();
    for (let line of body.split("\n")) {
      line = line.replace(/\/\/.*$/, "").trim();
      if (!line) continue;
      if (kind === "enum") {
        fields.add(line);
        continue;
      }
      const parts = line.split(/\s+/);
      if (line.startsWith("@@")) {
        // Directives matter (indexes, maps, uniques) but relation-name strings
        // and formatting do not, so normalise whitespace only.
        fields.add(line.replace(/\s+/g, ""));
      } else if (parts.length >= 2) {
        // field name + type is what determines the physical column.
        fields.add(`${parts[0]} ${parts[1]}`);
      }
    }
    out[name] = { kind, fields };
  }
  return out;
}

function main() {
  const parsed = {};
  for (const [svc, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) {
      console.error(`check:schema-mirrors — missing ${file}`);
      process.exit(1);
    }
    parsed[svc] = parse(fs.readFileSync(file, "utf8"));
  }

  const [a, b] = Object.keys(FILES);
  const problems = [];

  const allNames = new Set([...Object.keys(parsed[a]), ...Object.keys(parsed[b])]);
  for (const name of [...allNames].sort()) {
    const ina = parsed[a][name];
    const inb = parsed[b][name];

    if (!ina) {
      problems.push(`${name}: declared in ${b} but MISSING from ${a} — a push from ${a} would drop it`);
      continue;
    }
    if (!inb) {
      problems.push(`${name}: declared in ${a} but MISSING from ${b} — a push from ${b} would drop it`);
      continue;
    }

    const onlyA = [...ina.fields].filter((f) => !inb.fields.has(f));
    const onlyB = [...inb.fields].filter((f) => !ina.fields.has(f));
    if (onlyA.length || onlyB.length) {
      const detail = [
        ...onlyA.map((f) => `      only in ${a}:  ${f}`),
        ...onlyB.map((f) => `      only in ${b}:  ${f}`),
      ].join("\n");
      problems.push(`${name}: field drift between the two schemas\n${detail}`);
    }
  }

  if (problems.length) {
    console.error(`\ncheck:schema-mirrors FAILED — ${problems.length} divergence(s):\n`);
    for (const p of problems) console.error(`  • ${p}`);
    console.error(
      `\nBoth services share the \`public\` schema. Mirror the change into the other` +
        `\nfile before running \`prisma db push\` from either one.\n`
    );
    process.exit(1);
  }

  console.log(
    `check:schema-mirrors passed — ${allNames.size} models/enums agree across ${a} and ${b}.`
  );
}

main();

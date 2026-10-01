#!/usr/bin/env node
/**
 * lint:legal — fail the build if any published legal document still contains
 * an unfilled placeholder.
 *
 * The documents in docs/legal/ are the single source of truth rendered by both
 * the web app and the mobile app. Shipping one with "[GRIEVANCE OFFICER NAME]"
 * still in it is its own compliance failure, so this runs in CI rather than
 * relying on someone remembering.
 *
 * A placeholder is any bracketed span that is NOT a markdown link — i.e. "[...]"
 * not immediately followed by "(". Markdown links are the only legitimate use of
 * square brackets in these documents.
 *
 * HOLD-unpublished-sections.md is excluded by design: it holds text for features
 * that do not exist yet and is never rendered on a public surface.
 */

const fs = require("fs");
const path = require("path");

const LEGAL_DIR = path.join(__dirname, "..", "docs", "legal");
const EXCLUDED = new Set(["HOLD-unpublished-sections.md", "CLIENT-APPROVAL.md"]);

// A bracketed span, non-greedy, allowed to span lines, not followed by "(".
const PLACEHOLDER = /\[([^\[\]]+)\](?!\()/g;

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

function main() {
  if (!fs.existsSync(LEGAL_DIR)) {
    console.error(`lint:legal — ${LEGAL_DIR} does not exist`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(LEGAL_DIR)
    .filter((f) => f.endsWith(".md") && !EXCLUDED.has(f))
    .sort();

  if (files.length === 0) {
    console.error("lint:legal — no documents found in docs/legal/");
    process.exit(1);
  }

  let total = 0;

  for (const file of files) {
    const full = path.join(LEGAL_DIR, file);
    const text = fs.readFileSync(full, "utf8");
    const findings = [];

    for (const m of text.matchAll(PLACEHOLDER)) {
      const body = m[1].replace(/\s+/g, " ").trim();
      findings.push({ line: lineOf(text, m.index), body });
    }

    if (findings.length > 0) {
      console.error(`\n  ${file} — ${findings.length} unfilled placeholder(s)`);
      for (const f of findings) {
        const shown = f.body.length > 90 ? `${f.body.slice(0, 90)}…` : f.body;
        console.error(`    docs/legal/${file}:${f.line}  [${shown}]`);
      }
      total += findings.length;
    }
  }

  if (total > 0) {
    console.error(
      `\nlint:legal FAILED — ${total} placeholder(s) across ${files.length} document(s).` +
        `\nThese must be completed by legal counsel before the documents are published.\n`
    );
    process.exit(1);
  }

  console.log(`lint:legal passed — ${files.length} document(s), no placeholders.`);
}

main();

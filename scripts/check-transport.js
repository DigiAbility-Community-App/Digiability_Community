#!/usr/bin/env node
/**
 * check:transport — fail if a production build could ship cleartext HTTP.
 *
 * The app previously pointed its production builds at http://<raw-ip> while
 * disabling both OS-level protections that would have flagged it:
 *   iOS     NSAppTransportSecurity.NSAllowsArbitraryLoads = true
 *   Android usesCleartextTraffic                          = true
 *
 * Every JWT, private message and disability disclosure crossed the network in
 * the clear. It also made two published claims untrue — Terms §7 and Privacy
 * Policy §10 both state that messages are encrypted in transit.
 *
 * This check exists so that cannot come back by accident. The preview and
 * production EAS profiles both talk to the live backend, so both must use
 * https/wss. The development profile carries no URLs (it reads the local,
 * gitignored .env), which is the only place http:// / ws:// belong.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const problems = [];

// ── 1. EAS preview + production profiles must use https / wss ──────────────
const easPath = path.join(ROOT, "apps/mobile/eas.json");
if (fs.existsSync(easPath)) {
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  for (const profile of ["preview", "production"]) {
    const env = eas.build?.[profile]?.env ?? {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== "string" || !key.endsWith("_URL")) continue;
      const scheme = key.endsWith("_SOCKET_URL") ? "wss://" : "https://";
      if (!value.startsWith(scheme)) {
        problems.push(`eas.json ${profile} profile: ${key} must start with ${scheme} (${value})`);
      }
    }
  }
}

// ── 2. Web production env must not use http:// ──────────────────────────────
const webEnv = path.join(ROOT, "apps/web/.env.production");
if (fs.existsSync(webEnv)) {
  for (const line of fs.readFileSync(webEnv, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=");
    if (value.startsWith("http://")) {
      problems.push(`apps/web/.env.production: ${key} is cleartext (${value})`);
    }
  }
}

// ── 3. Production builds must not disable ATS or allow cleartext ────────────
try {
  process.env.EAS_BUILD_PROFILE = "production";
  const base = require(path.join(ROOT, "apps/mobile/app.json")).expo;
  const resolve = require(path.join(ROOT, "apps/mobile/app.config.js"));
  const cfg = typeof resolve === "function" ? resolve({ config: base }) : resolve;

  const ats = cfg.ios?.infoPlist?.NSAppTransportSecurity;
  if (ats?.NSAllowsArbitraryLoads) {
    problems.push("app.config.js: production disables iOS App Transport Security");
  }

  const buildProps = (cfg.plugins ?? []).find(
    (p) => Array.isArray(p) && p[0] === "expo-build-properties"
  );
  if (buildProps?.[1]?.android?.usesCleartextTraffic) {
    problems.push("app.config.js: production allows Android cleartext traffic");
  }

  // src/config/env.ts keys its startup https/wss guard off this value.
  if (cfg.extra?.buildProfile !== "production") {
    problems.push("app.config.js: extra.buildProfile is not exposed, so the runtime https guard is off");
  }
} catch (e) {
  problems.push(`could not resolve the production Expo config: ${e.message}`);
}

// ── 4. No cleartext URLs hardcoded in mobile source ─────────────────────────
// Endpoints come only from src/config/env.ts. A literal http:// or ws:// URL in
// source is a fallback waiting to ship. Bare scheme strings ("http://") used
// for prefix checks have no host and don't match.
const SKIP = new Set(["legal-docs.generated.ts"]);
const CLEARTEXT_URL = /["'`](?:http|ws):\/\/[^"'`\s]+/;
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
    } else if (/\.(ts|tsx|js)$/.test(entry.name) && !SKIP.has(entry.name)) {
      fs.readFileSync(full, "utf8").split("\n").forEach((line, i) => {
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*")) return;
        if (CLEARTEXT_URL.test(code)) {
          problems.push(`${path.relative(ROOT, full)}:${i + 1}: hardcoded cleartext URL`);
        }
      });
    }
  }
}
scan(path.join(ROOT, "apps/mobile/src"));

if (problems.length > 0) {
  console.error(`\ncheck:transport FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  • ${p}`);
  console.error(
    "\nProduction builds must use https and must not disable ATS or allow cleartext." +
      "\nSee docs/runbooks/transport-security.md.\n"
  );
  process.exit(1);
}

console.log(
  "check:transport passed — preview/production use https/wss, ATS is enforced, cleartext is denied, no cleartext URLs in source."
);

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
 * This check exists so that cannot come back by accident. It deliberately does
 * NOT police the development or preview profiles: those are internal builds
 * against LAN addresses and are expected to use cleartext.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const problems = [];

// ── 1. EAS production profile must not use http:// ──────────────────────────
const easPath = path.join(ROOT, "apps/mobile/eas.json");
if (fs.existsSync(easPath)) {
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  const env = eas.build?.production?.env ?? {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.startsWith("http://")) {
      problems.push(`eas.json production profile: ${key} is cleartext (${value})`);
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
} catch (e) {
  problems.push(`could not resolve the production Expo config: ${e.message}`);
}

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
  "check:transport passed — production uses https, ATS is enforced, cleartext is denied."
);

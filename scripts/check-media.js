#!/usr/bin/env node
/**
 * check:media — fail if the image viewer / save / share regressions come back.
 *
 * Pinch-zoom and "Save to Gallery" / "Share" were "fixed" five times and kept
 * breaking in EAS APKs, because each fix patched a symptom. The root causes
 * and the rules that keep them fixed are documented in
 * apps/mobile/docs/media-release-checklist.md. This script enforces the parts
 * a machine can check. It runs on every EAS build (apps/mobile package.json
 * "eas-build-post-install") and via `npm run check:media`.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MOBILE = path.join(ROOT, "apps/mobile");
const problems = [];
const read = (p) => fs.readFileSync(p, "utf8");

// ── 1. The old viewer must not come back ────────────────────────────────────
// react-native-image-viewing (unmaintained since 2020) reset Android zoom on
// every re-render; zoom is now react-native-zoom-toolkit.
const pkg = JSON.parse(read(path.join(MOBILE, "package.json")));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
if (deps["react-native-image-viewing"]) {
  problems.push("apps/mobile/package.json: react-native-image-viewing is back — use react-native-zoom-toolkit (see MediaViewer.tsx)");
}
if (!deps["react-native-zoom-toolkit"]) {
  problems.push("apps/mobile/package.json: react-native-zoom-toolkit is missing — MediaViewer depends on it");
}

// ── 2. MediaViewer structure ────────────────────────────────────────────────
const viewerPath = path.join(MOBILE, "src/components/chat/MediaViewer.tsx");
const viewer = read(viewerPath);
if (!/<GestureHandlerRootView\b/.test(viewer)) {
  problems.push("MediaViewer.tsx: Modal content must be wrapped in <GestureHandlerRootView> (Android gestures don't fire inside a Modal without it)");
}
// Hooks after a conditional `return` crashed the forum viewer ("Rendered more
// hooks than during the previous render"). Flag any component-level early
// return of the form `if (...) return` before the last hook call in the file's
// main component.
{
  const implStart = viewer.indexOf("function MediaViewerImpl");
  const implEnd = viewer.indexOf("\nfunction ", implStart + 1);
  const impl = viewer.slice(implStart, implEnd === -1 ? undefined : implEnd);
  const lines = impl.split("\n");
  let firstEarlyReturn = -1;
  let lastHook = -1;
  lines.forEach((line, i) => {
    // Only top-level statements of the component body (2-space indent).
    if (/^  if \(.*\) return\b/.test(line) || /^  if \(.*\) \{$/.test(line) && /^\s+return\b/.test(lines[i + 1] || "")) {
      if (firstEarlyReturn === -1) firstEarlyReturn = i;
    }
    if (/^  (const|let) .*\buse[A-Z]\w*\(/.test(line) || /^  use[A-Z]\w*\(/.test(line)) lastHook = i;
  });
  if (firstEarlyReturn !== -1 && lastHook > firstEarlyReturn) {
    problems.push("MediaViewer.tsx: a hook is called after an early return in MediaViewerImpl — move every hook above any conditional return");
  }
}

// ── 3. Save / share only through the shared pipeline ────────────────────────
// Every image save/share must go through utils/mediaFile.ts
// (prepareLocalMediaFile + utils/mediaPolicy.ts). Ad-hoc call sites are how
// forum images and event posters ended up rejected or saved blank.
const ALLOWED = new Map([
  ["src/components/chat/MediaViewer.tsx", ["saveToLibraryAsync", "Sharing.shareAsync"]],
  ["src/screens/events/EventDetailScreen.tsx", ["Sharing.shareAsync"]],
  // Shares the user's JSON data export (DPDP access request), not media.
  ["src/screens/profile/PrivacyDataScreen.tsx", ["Sharing.shareAsync"]],
]);
const CALLS = ["saveToLibraryAsync", "createAssetAsync", "Sharing.shareAsync"];
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { scan(full); continue; }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const rel = path.relative(MOBILE, full);
    read(full).split("\n").forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith("//") || code.startsWith("*")) return;
      for (const call of CALLS) {
        if (code.includes(`${call}(`) && !(ALLOWED.get(rel) || []).includes(call)) {
          problems.push(`apps/mobile/${rel}:${i + 1}: ${call}() outside the shared media pipeline — use MediaViewer / prepareLocalMediaFile()`);
        }
      }
      if (/isAllowedOrigin\s*[=:]/.test(code)) {
        problems.push(`apps/mobile/${rel}:${i + 1}: per-caller origin checks were removed — the rule lives in utils/mediaPolicy.ts`);
      }
    });
  }
}
scan(path.join(MOBILE, "src"));

// data: URLs (event posters) must be decoded, not written as text.
const mediaFileCode = read(path.join(MOBILE, "src/utils/mediaFile.ts"))
  .split("\n")
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join("\n");
if (!/encoding:\s*"base64"/.test(mediaFileCode)) {
  problems.push('utils/mediaFile.ts: data URLs must be written with { encoding: "base64" } — without it Gallery gets a blank image');
}

// ── 4. forum-svc must store host-relative media paths ───────────────────────
const forumController = read(path.join(ROOT, "services/forum-svc/src/controllers/forum.controller.ts"));
if (/req\.protocol\}?:\/\/\$\{?req\.get\(['"]host['"]\)\}?\/uploads/.test(forumController.replace(/\s/g, ""))) {
  problems.push("forum.controller.ts: media URLs are built from the request host again — store '/uploads/<file>' (see uploadPath)");
}

if (problems.length > 0) {
  console.error(`\ncheck:media FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nSee apps/mobile/docs/media-release-checklist.md for why these rules exist.\n");
  process.exit(1);
}

console.log("check:media passed — zoom-toolkit viewer, gesture root in Modal, save/share via the shared pipeline, relative forum media.");

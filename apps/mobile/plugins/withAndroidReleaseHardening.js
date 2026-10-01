// ─────────────────────────────────────────────────────────────
// Android release hardening (VAPT) — applied to `production` builds only,
// from app.config.js.
//
// 1. Strips the `exp+<slug>` URL scheme that expo-dev-client adds to
//    MainActivity. It only exists so a dev client can open development
//    bundles; in a store build it is an exported, unauthenticated entry
//    point with no purpose.
// 2. Removes SYSTEM_ALERT_WINDOW (draw over other apps). The RN template adds
//    it for the dev overlay; the app never uses it.
// 3. Forces android:exported="false" on library components that declare
//    themselves exported but are never called from outside the app
//    (EXPORTED_LOCKDOWN below). Components that must stay exported are
//    documented in KEEP_EXPORTED and left alone.
// ─────────────────────────────────────────────────────────────

const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const REMOVED_PERMISSIONS = ["android.permission.SYSTEM_ALERT_WINDOW"];

// Library components (from Gradle AARs, merged at build time) that are
// exported but have no legitimate external caller. Filled from the merged
// manifest of a real production build — see docs/runbooks/android-release-hardening.md.
// Found in the merged manifest of EAS build b608515d (2026-10-01):
const EXPORTED_LOCKDOWN = [
  // expo-image-picker's crop screen (CanHub cropper). Only ever launched by
  // the app itself with an explicit intent; exported let any app start it.
  { tag: "activity", name: "com.canhub.cropper.CropImageActivity" },
  // Jetpack Compose @Preview host — developer tooling that leaks into release
  // builds through a transitive dependency. No purpose in production.
  { tag: "activity", name: "androidx.compose.ui.tooling.PreviewActivity" },
];

// Kept exported on purpose (documentation only — nothing is changed for these):
//   activity  .MainActivity                                   launcher; the OS must be able to start it
//   receiver  com.google.firebase.iid.FirebaseInstanceIdReceiver
//             FCM push delivery; guarded by com.google.android.c2dm.permission.SEND,
//             a signature permission only Google Play services holds
//   receiver  androidx.profileinstaller.ProfileInstallReceiver
//             baseline-profile install; guarded by android.permission.DUMP,
//             which only the shell/system holds

function isDevClientSchemeFilter(filter) {
  return (filter.data ?? []).some((d) => {
    const scheme = d.$?.["android:scheme"];
    return typeof scheme === "string" && scheme.startsWith("exp+");
  });
}

function ensureToolsNamespace(manifest) {
  manifest.manifest.$ = manifest.manifest.$ ?? {};
  manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
}

module.exports = function withAndroidReleaseHardening(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    ensureToolsNamespace(manifest);

    // 1. Dev-client scheme off MainActivity
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
    mainActivity["intent-filter"] = (mainActivity["intent-filter"] ?? []).filter(
      (filter) => !isDevClientSchemeFilter(filter)
    );

    // 2. Permissions: drop our own declaration and block library re-adds
    const perms = (manifest.manifest["uses-permission"] ?? []).filter(
      (p) => !REMOVED_PERMISSIONS.includes(p.$["android:name"])
    );
    for (const name of REMOVED_PERMISSIONS) {
      perms.push({ $: { "android:name": name, "tools:node": "remove" } });
    }
    manifest.manifest["uses-permission"] = perms;

    // 3. Exported lockdown via manifest-merger overrides
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    for (const { tag, name } of EXPORTED_LOCKDOWN) {
      const list = (app[tag] = app[tag] ?? []);
      const existing = list.find((c) => c.$["android:name"] === name);
      const attrs = { "android:name": name, "android:exported": "false", "tools:replace": "android:exported" };
      if (existing) Object.assign(existing.$, attrs);
      else list.push({ $: attrs });
    }

    return cfg;
  });
};

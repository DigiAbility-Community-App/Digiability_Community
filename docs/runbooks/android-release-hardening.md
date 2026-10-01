# Android release hardening — what a production build guarantees

Applies to the EAS `production` profile. Configured in `apps/mobile/app.json`
(`expo-build-properties`, `allowBackup`), `apps/mobile/app.config.js` (cleartext/ATS per profile)
and `apps/mobile/plugins/withAndroidReleaseHardening.js` (production only).

Verified against the merged manifest of EAS build `b608515d` (2026-10-01):

| Setting | Value |
|---|---|
| `minSdkVersion` | 26 (Android 8.0) — Android 7.x devices can no longer install or update |
| `android:allowBackup` | `false`; SecureStore backup/data-extraction exclusion rules also present |
| `android:usesCleartextTraffic` | `false` |
| `android:debuggable` | absent (release) |
| R8 minify + resource shrinking | on (`enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`) |
| `console.log/info/debug` | stripped from the JS bundle (`babel.config.js`, production env); `error`/`warn` kept |
| Custom URL schemes / App Links | none. The dev-client `exp+digiability-community` scheme is stripped |
| `SYSTEM_ALERT_WINDOW` | removed |
| WebView | no WebView library; no `setWebContentsDebuggingEnabled` anywhere |

## Exported components

| Component | Exported | Why |
|---|---|---|
| `.MainActivity` | yes | Launcher — the OS must be able to start the app |
| `com.google.firebase.iid.FirebaseInstanceIdReceiver` | yes | FCM push delivery. Guarded by `com.google.android.c2dm.permission.SEND`, a signature permission only Google Play services holds |
| `androidx.profileinstaller.ProfileInstallReceiver` | yes | Baseline-profile installation. Guarded by `android.permission.DUMP`, held only by the shell/system |
| `com.canhub.cropper.CropImageActivity` | **forced `false`** | Image-picker crop screen; only launched by the app itself |
| `androidx.compose.ui.tooling.PreviewActivity` | **forced `false`** | Compose developer tooling leaking into release; no production use |
| 21 other components | `false` | Library defaults |

## Re-verifying after dependency upgrades

New libraries can add exported components. After upgrading Expo or native dependencies, build
the `production` profile and decode the APK manifest (no Android SDK needed):

```bash
npm i @devicefarmer/adbkit-apkreader   # in a scratch directory
node -e 'require("@devicefarmer/adbkit-apkreader").open("app.apk").then(r=>r.readManifest()).then(m=>console.log(JSON.stringify(m.application,null,1)))'
```

Anything newly exported without a caller outside the app goes into `EXPORTED_LOCKDOWN` in the plugin.

## If https deep links are ever added (Android App Links)

1. Add `android.intentFilters` in `app.json` with `"autoVerify": true`, `scheme: "https"` and the host.
2. Publish `https://<host>/.well-known/assetlinks.json` with the **release** SHA-256 fingerprint
   from `eas credentials -p android` (the Play App Signing key if Play signing is used).
3. Every route a link opens must validate its parameters and require an authenticated session,
   the same way `src/navigation/notificationRouting.ts` handles notification taps.

# Media release checklist — image zoom, Save to Gallery, Share

Pinch-zoom and Save/Share were "fixed" five times between Aug and Oct 2026 and kept breaking in EAS-built APKs. Every one of those fixes patched a symptom and was checked in a dev build, not a release APK. This page records the real root causes, the rules that keep them fixed, and the device test to run before every release that touches media.

`scripts/check-media.js` enforces the rules a machine can check. It runs on every EAS build (`eas-build-post-install` in `apps/mobile/package.json`) and via `npm run check:media`. The device test below is the part it can't do.

## Root causes (Oct 2026)

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| Z1 | Zoom snaps back on Android, worst in a busy chat | `react-native-image-viewing` (unmaintained since 2020) kept zoom state in render-scoped variables; every re-render (presence, typing, new message) reset it | Replaced with `react-native-zoom-toolkit` `ResumableZoom`; zoom state lives in Reanimated shared values |
| Z2 | Double-tap jumps to ~20× on photos; small images shrink | Absolute `SCALE_MAX = 2` on native pixel size | Max zoom is relative to the fitted size (`MAX_ZOOM = 4`) |
| Z3 | Forum image viewer crashes on first tap | A hook after an early `return` in `MediaViewer` | All hooks above any conditional return (guarded) |
| Z4 | Gestures dead in the viewer on Android | RN `Modal` content not wrapped in `GestureHandlerRootView` | Wrapped (guarded) |
| S1 | Forum images blank / unsavable in production APKs | forum-svc stored `http://<node-ip>:30503/uploads/…`; production denies cleartext | forum-svc stores `/uploads/…`; app resolves via `resolveForumMediaUrl`; `services/forum-svc/scripts/2026-10-media-urls-relative.sql` rewrites old rows |
| S2 | "This media's source isn't recognized" | Viewer only allowed the chat-svc origin | One rule in `src/utils/mediaPolicy.ts`; no per-caller overrides (guarded) |
| S3 | Old images blank, Save fails with 404 after a deploy | Uploads on pod-local disk, wiped by every redeploy | PVC for chat-svc/forum-svc uploads — `DEVOPS_TASKS.txt` item 19 (S3/R2 later, item 22) |
| S4 | Share sends text but no image, no error | Silent text-only fallback; share errors not logged | Failures shown to the user and logged as `[media]` |
| S5 | "Saved ✓" but the image is blank | Base64 written as text / error page saved as `.jpg` | Base64 decode (guarded) + file type sniffed from magic bytes |
| — | Forum posts fail with 500 but are saved | BullMQ rejected queue name `moderation:classify` | Renamed `moderation-classify`; enqueue can't fail a request |

## Rules

- **One viewer**: `src/components/chat/MediaViewer.tsx`. No other full-screen image viewer, no other zoom library.
- **One pipeline**: every save/share goes through `prepareLocalMediaFile()` in `src/utils/mediaFile.ts`. The allow/deny rule is only in `src/utils/mediaPolicy.ts`.
- **Media URLs from the server are host-relative** (`/uploads/x.jpg`) for chat-svc and forum-svc. Clients resolve them with `resolveMediaUrl` (chat) / `resolveForumMediaUrl` (forum). Never build absolute URLs from the request host on the server.
- **No silent fallbacks**: a failed save/share always shows an alert with the reason and logs `[media] <step> <src> <error>`.

## Device test (release APK, not a dev build)

Build an EAS **preview** APK (production env: https only, cleartext denied). Test on a physical **Android 13+** phone and one **Android 10–12** phone, plus iOS when an iOS build exists.

**Zoom**
- [ ] Pinch in/out: zooms around the fingers, never smaller than fit, stops at 4×.
- [ ] Pan while zoomed stays inside the image edges.
- [ ] Double-tap zooms in at the tap point; double-tap again returns to fit.
- [ ] Repeat with a tiny image (≤300 px) and a large phone photo (≥4000 px).
- [ ] In a busy group chat (someone else typing/sending), zoom in and wait 30 s — it stays zoomed.
- [ ] Forum question image and forum answer image open without a crash.

**Save to Gallery** — then open the Gallery/Photos app and check the image is not blank:
- [ ] Chat image (DM) · [ ] Chat image (group) · [ ] Chat video
- [ ] Forum question image · [ ] Forum answer image
- [ ] Event poster uploaded in admin (data URL) · [ ] Event poster from an https link

**Share** — to WhatsApp and Gmail; the image (not just text) is attached:
- [ ] the same seven items as above

**Failure paths**
- [ ] Airplane mode → Save → clear "Couldn't download…" alert (no fake ✓).
- [ ] Deny the photo permission → Save → permission alert with "Open Settings" when permanently denied.

## Diagnosing a failure on a real APK

`console.warn`/`console.error` survive release builds, so every failing step shows up in logcat:

```bash
adb logcat -c
adb logcat ReactNativeJS:V ExpoModulesCore:V AndroidRuntime:E '*:S' | grep -E "\[media\]|Error"
```

The `[media]` line names the step (`blocked`, `download failed`, `save failed`, `share failed`, …) and the source URL.

| Logged | Meaning |
|---|---|
| `download failed … response has status: 404` | The file is gone from the server — check the uploads PVC (DEVOPS item 19) |
| `… CLEARTEXT communication … not permitted` | An `http://` media URL reached a production build — find who stored it absolute |
| `blocked` | `mediaPolicy.ts` refused the source — check the URL scheme |
| `unsupported` | The server returned something that isn't an image/video (e.g. an error page) |

Check what actually shipped in an APK:

```bash
apkanalyzer manifest print app.apk | grep -E "usesCleartextTraffic|READ_MEDIA|EXTERNAL_STORAGE|SharingFileProvider"
```

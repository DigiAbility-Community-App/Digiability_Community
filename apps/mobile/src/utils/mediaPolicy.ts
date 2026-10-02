// ─────────────────────────────────────────────────────────────
// The single rule for which media the app may download to the device
// (save to Gallery / share). Every save and share path goes through
// prepareLocalMediaFile(), which applies this — there is deliberately no
// per-caller override.
//
// History: each screen used to pass its own origin check. The viewer
// defaulted to "chat-svc origin only", so forum images and https event
// posters were always refused ("This media's source isn't recognized"), and
// every new screen that opened the viewer re-introduced the same bug.
// ─────────────────────────────────────────────────────────────

import { BUILD_PROFILE } from "@config/env";

export type MediaSourceKind = "data" | "local" | "remote";

export function classifyMediaSource(src: string): MediaSourceKind | null {
  if (/^data:/i.test(src)) return "data";
  if (/^(file|content):/i.test(src)) return "local";
  if (/^https?:\/\//i.test(src)) return "remote";
  return null;
}

/**
 * Returns null when `src` may be fetched to the device, or a user-facing
 * reason when it may not.
 *
 *  - data:image/* and data:video/* — always (event posters are stored inline)
 *  - file:// and content:// — always (the user's own just-picked media)
 *  - https:// — chat/forum uploads, and any https host for admin-set event
 *    posters. Media is fetched without credentials, so an https host only
 *    exposes what it already serves publicly.
 *  - http:// — only outside production builds, where the dev backend is
 *    cleartext. Production builds deny cleartext at the OS layer anyway;
 *    refusing here turns an opaque network error into a clear message.
 */
export function mediaSourceBlockReason(src: string): string | null {
  const kind = classifyMediaSource(src);
  if (kind === null) return "This media can't be saved because its address isn't recognized.";
  if (kind === "data") {
    return /^data:(image|video)\/[\w.+-]+;base64,/i.test(src)
      ? null
      : "Only images and videos can be saved.";
  }
  if (kind === "local") return null;

  if (/^https:\/\//i.test(src)) return null;
  // http://
  if (BUILD_PROFILE !== "production") return null;
  return "This media is served over an insecure connection and can't be downloaded.";
}

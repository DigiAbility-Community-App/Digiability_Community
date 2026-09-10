// ─────────────────────────────────────────────────────────────
// Turn a media source (remote URL or base64 data URL) into a real local file
// that can be handed to expo-media-library or expo-sharing.
//
// Extracted from MediaViewer so the events screen can share an event poster
// through exactly the same path. Duplicating it would mean duplicating the
// encoding subtlety below, which is precisely how the "Saved to Gallery ✓ but
// the image is blank" bug happened.
// ─────────────────────────────────────────────────────────────

import { File, Paths } from "expo-file-system";

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export interface PrepareMediaOptions {
  isVideo?: boolean;
  /**
   * Gate on where a remote file may be fetched from. Chat media is restricted
   * to the chat-svc origin; event posters can legitimately come from an
   * arbitrary URL an admin pasted, so that caller passes a permissive check.
   */
  isAllowedOrigin?: (url: string) => boolean;
}

/**
 * Returns a `file://` URI for `src`, downloading or decoding as needed.
 * Throws with a user-presentable message on failure.
 */
export async function prepareLocalMediaFile(
  src: string,
  { isVideo = false, isAllowedOrigin }: PrepareMediaOptions = {}
): Promise<string> {
  // Remote URL — download to cache first
  if (src.startsWith("http://") || src.startsWith("https://")) {
    if (isAllowedOrigin && !isAllowedOrigin(src)) {
      throw new Error("This media's source isn't recognized, so it can't be downloaded.");
    }

    const rawExt = src.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
    const validExts = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "webm"];
    const safeExt = validExts.includes(rawExt) ? rawExt : isVideo ? "mp4" : "jpg";
    const destFile = new File(Paths.cache, `digiability-${Date.now()}.${safeExt}`);

    // downloadAsync was removed from the main expo-file-system export in
    // SDK 54 (throws at runtime) — File.downloadFileAsync is its replacement.
    const downloaded = await File.downloadFileAsync(src, destFile, { idempotent: true });

    const saved = new File(downloaded.uri);
    if (saved.exists && (saved.size ?? 0) > MAX_DOWNLOAD_BYTES) {
      saved.delete();
      throw new Error("This file is too large to download.");
    }
    if (!saved.exists || (saved.size ?? 0) === 0) {
      throw new Error("The download didn't complete. Please try again.");
    }
    return downloaded.uri;
  }

  // Base64 data URL
  if (src.startsWith("data:")) {
    const extMatch = src.match(/^data:image\/([\w.+-]+);base64,/);
    const ext = (extMatch?.[1] ?? "jpg").replace("+xml", "");
    const destFile = new File(Paths.cache, `digiability-${Date.now()}.${ext}`);

    const base64 = src.replace(/^data:image\/[\w.+-]+;base64,/, "");
    // encoding MUST be given — write() defaults to UTF-8, which would store
    // the base64 *text* rather than the decoded bytes. The file would still
    // exist and be non-zero, so every success check passes while the image
    // itself is unreadable.
    destFile.write(base64, { encoding: "base64" });

    const written = new File(destFile.uri);
    if (!written.exists || (written.size ?? 0) === 0) {
      throw new Error("Could not prepare this image for saving.");
    }
    return destFile.uri;
  }

  // Already a local file
  return src;
}

/** Best-effort mime type from the cached file's extension. */
export function mimeTypeForUri(uri: string, isVideo = false): string {
  if (isVideo) return "video/mp4";
  const ext = uri.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

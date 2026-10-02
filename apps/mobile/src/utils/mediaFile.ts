// ─────────────────────────────────────────────────────────────
// The one pipeline that turns any media source into a real local file for
// expo-media-library (Save to Gallery) and expo-sharing (Share).
//
// Every save/share in the app goes through prepareLocalMediaFile(). Keep it
// that way — scripts/check-transport.js fails CI if saveToLibraryAsync or
// Sharing.shareAsync is called anywhere other than MediaViewer.tsx and
// EventDetailScreen.tsx, which both use this file.
//
// Hard-won rules (each one was a shipped bug):
//  - Base64 must be written with encoding:"base64" — otherwise the base64
//    TEXT is stored, the file is non-empty, and Gallery shows a blank image.
//  - The file's real type (sniffed from its first bytes) decides the
//    extension/MIME, not the URL — a URL without an extension, or a server
//    error page, used to be saved as .jpg.
//  - Every failure throws a MediaError with a user-facing message and is
//    logged with a "[media]" prefix. console.warn survives release builds
//    (babel transform-remove-console keeps warn/error), so `adb logcat`
//    shows exactly which step failed on a real APK.
// ─────────────────────────────────────────────────────────────

import { File, Paths } from "expo-file-system";
import { classifyMediaSource, mediaSourceBlockReason } from "./mediaPolicy";

const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export type MediaErrorCode = "blocked" | "network" | "not_found" | "unsupported" | "too_large" | "write_failed";

export class MediaError extends Error {
  constructor(public code: MediaErrorCode, message: string) {
    super(message);
    this.name = "MediaError";
  }
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/3gpp": "3gp",
};
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])
);
MIME_BY_EXT.jpeg = "image/jpeg";

function extFromPath(path: string): string | undefined {
  const ext = path.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase();
  return ext && MIME_BY_EXT[ext] ? ext : undefined;
}

/** Log a step of the pipeline without dumping a whole base64 payload. */
export function logMedia(step: string, src: string, detail?: unknown): void {
  const shown = src.startsWith("data:") ? `${src.slice(0, 40)}…(${src.length} chars)` : src;
  console.warn("[media]", step, shown, detail ?? "");
}

function newCacheFile(ext: string): File {
  return new File(Paths.cache, `digiability-${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`);
}

/**
 * The file's real MIME type from its first bytes ("magic numbers"), or null
 * if it isn't a format we save. File.type can't be used: on Android it is
 * derived from the extension we chose, so a 200-status HTML/JSON error page
 * downloaded as ".jpg" would pass as an image.
 */
function sniffMime(file: File): string | null {
  const handle = file.open();
  let b: Uint8Array;
  try {
    b = handle.readBytes(16);
  } finally {
    handle.close();
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (/^(heic|heix|hevc|heim|heis)$/.test(brand)) return "image/heic";
    if (/^(mif1|msf1)$/.test(brand)) return "image/heif";
    if (brand === "qt  ") return "video/quicktime";
    if (/^3g/.test(brand)) return "video/3gpp";
    return "video/mp4"; // isom, mp41, mp42, avc1, M4V, …
  }
  return null;
}

/**
 * Verify a cached file is a real, non-empty image/video and give it the
 * extension matching its content — MediaLibrary and the Android share sheet
 * both decide what a file is from its extension.
 */
function normalizeCachedFile(file: File): File {
  if (!file.exists || (file.size ?? 0) === 0) {
    throw new MediaError("write_failed", "The file couldn't be saved on this device. Please try again.");
  }
  if ((file.size ?? 0) > MAX_DOWNLOAD_BYTES) {
    file.delete();
    throw new MediaError("too_large", "This file is too large to download.");
  }
  const mime = sniffMime(file);
  if (!mime) {
    // e.g. an HTML/JSON error page served with status 200, or an SVG
    file.delete();
    throw new MediaError("unsupported", "This file isn't a supported image or video, so it can't be saved.");
  }
  const ext = EXT_BY_MIME[mime];
  if (extFromPath(file.uri) === ext) return file;
  const renamed = newCacheFile(ext);
  file.move(renamed);
  return renamed;
}

/**
 * Returns a `file://` URI in the app cache for `src` (https/http URL, data:
 * URL, or a local file:// / content:// URI), downloading, decoding or copying
 * as needed. Throws MediaError with a user-presentable message on failure.
 */
export async function prepareLocalMediaFile(src: string, { isVideo = false }: { isVideo?: boolean } = {}): Promise<string> {
  const fallbackExt = extFromPath(src) ?? (isVideo ? "mp4" : "jpg");

  const blocked = mediaSourceBlockReason(src);
  if (blocked) {
    logMedia("blocked", src, blocked);
    throw new MediaError("blocked", blocked);
  }

  const kind = classifyMediaSource(src);

  if (kind === "remote") {
    let downloaded: File;
    try {
      const result = await File.downloadFileAsync(src, newCacheFile(fallbackExt), { idempotent: true });
      downloaded = new File(result.uri);
    } catch (err) {
      logMedia("download failed", src, err);
      const message = err instanceof Error ? err.message : String(err);
      if (/\b404\b/.test(message)) {
        throw new MediaError("not_found", "This file is no longer available on the server.");
      }
      if (/cleartext/i.test(message)) {
        throw new MediaError("blocked", "This media is served over an insecure connection and can't be downloaded.");
      }
      throw new MediaError("network", "Couldn't download the file. Check your connection and try again.");
    }
    return normalizeCachedFile(downloaded).uri;
  }

  if (kind === "data") {
    const match = /^data:((image|video)\/[\w.+-]+);base64,/i.exec(src)!;
    const mime = match[1].toLowerCase();
    const ext = EXT_BY_MIME[mime];
    if (!ext) {
      logMedia("unsupported data type", src, mime);
      throw new MediaError("unsupported", "This image format can't be saved. Ask for a JPEG, PNG or WebP version.");
    }
    const dest = newCacheFile(ext);
    try {
      // encoding MUST be given — see header note.
      dest.write(src.slice(match[0].length), { encoding: "base64" });
    } catch (err) {
      logMedia("decode failed", src, err);
      throw new MediaError("write_failed", "Couldn't prepare this image for saving.");
    }
    return normalizeCachedFile(dest).uri;
  }

  // Local file:// or content:// — copy into the cache so the share sheet's
  // FileProvider can expose it and it has a real extension.
  try {
    const source = new File(src);
    const dest = newCacheFile(fallbackExt);
    source.copy(dest);
    return normalizeCachedFile(dest).uri;
  } catch (err) {
    if (err instanceof MediaError) throw err;
    logMedia("local copy failed", src, err);
    throw new MediaError("write_failed", "Couldn't read this file from your device.");
  }
}

/** MIME type of a file prepared by prepareLocalMediaFile (by its extension). */
export function mimeTypeForUri(uri: string, isVideo = false): string {
  const ext = extFromPath(uri);
  if (ext) return MIME_BY_EXT[ext];
  return isVideo ? "video/mp4" : "image/jpeg";
}

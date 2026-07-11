// ─────────────────────────────────────────────────────────────
// Media Upload Middleware (multer, disk storage)
//
// Stores chat attachments (images + voice notes) on local disk
// and serves them back via the /uploads static route.
// Mirrors the proven pattern used by forum-svc.
//
// NOTE: local disk is fine for dev/single-node. For horizontal
// scaling this should move to object storage (S3/GCS) behind a
// signed-URL flow — the controller is the only thing that would
// change (it returns the public URL).
// ─────────────────────────────────────────────────────────────

import multer from "multer";
import path from "path";
import fs from "fs";
import { Request } from "express";

const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || extFromMime(file.mimetype);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_AUDIO = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/x-caf", // iOS expo-av HIGH_QUALITY preset records .caf
  "application/octet-stream",
];

function extFromMime(mime: string): string {
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return ".m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return ".mp3";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("caf")) return ".caf";
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("ogg")) return ".ogg";
  return "";
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (
    ALLOWED_IMAGE.includes(file.mimetype) ||
    ALLOWED_AUDIO.includes(file.mimetype) ||
    file.fieldname === "audio" ||
    file.fieldname === "image"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image and audio uploads are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB — voice notes + photos
  },
});

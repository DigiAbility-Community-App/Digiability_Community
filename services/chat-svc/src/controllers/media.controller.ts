// ─────────────────────────────────────────────────────────────
// Media Controller
// Accepts a single image/audio file, stores it, returns a public URL.
// The client then sends a message.send WS event with type=IMAGE/AUDIO
// and content=<url> (plus optional metadata: duration, alt text).
// ─────────────────────────────────────────────────────────────

import { Request, Response } from "express";
import { asyncHandler } from "../middleware/error.middleware";

// Return a HOST-RELATIVE path (e.g. "/uploads/image-123.jpg"), NOT an absolute
// URL. Baking the uploader's request host (localhost / 10.0.2.2 / a LAN IP) into
// the URL breaks other clients that can't resolve that host. Each client instead
// resolves this path against its own chat-svc base URL when rendering.
export const uploadMedia = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ success: false, message: "No file uploaded" });
    return;
  }

  const kind = file.mimetype.startsWith("audio") || file.fieldname === "audio"
    ? "AUDIO"
    : "IMAGE";

  res.status(201).json({
    success: true,
    data: {
      url: `/uploads/${file.filename}`,
      kind,
      mimeType: file.mimetype,
      size: file.size,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Media Routes
// POST /api/media/upload — upload a chat attachment (image/audio)
// ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload.middleware";
import { uploadMedia } from "../controllers/media.controller";

const router = Router();

router.use(authenticate);

// Accept either an "image" or "audio" form field (single file).
router.post("/upload", upload.any(), (req, res, next) => {
  // upload.any() puts files on req.files; normalise to req.file for the controller.
  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    (req as any).file = files[0];
  }
  next();
}, uploadMedia);

export default router;

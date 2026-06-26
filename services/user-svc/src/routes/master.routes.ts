import { Router } from "express";
import prisma from "../models/prisma.client";

const router = Router();

// Public endpoint — no auth needed for master data lookups
router.get("/disability-types", async (_req, res, next) => {
  try {
    const types = await prisma.$queryRaw<{ id: string; name: string; code: string }[]>`
      SELECT id, name, code
      FROM disability_types
      WHERE status = 'Active'
      ORDER BY code
    `;
    res.json({ success: true, data: types });
  } catch {
    // Table may not exist yet if admin panel has never been opened; return empty list
    res.json({ success: true, data: [] });
  }
});

export default router;

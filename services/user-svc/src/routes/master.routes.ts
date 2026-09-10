import { Router } from "express";
import prisma from "../models/prisma.client";
import {
  getPasswordPolicy,
  describePasswordPolicy,
} from "../services/passwordPolicy.service";

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

router.get("/event-categories", async (_req, res, next) => {
  try {
    const categories = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM event_categories
      WHERE status = 'Active'
      ORDER BY name
    `;
    res.json({ success: true, data: categories });
  } catch {
    // Table may not exist yet if admin panel has never been opened; return empty list
    res.json({ success: true, data: [] });
  }
});

router.get("/service-categories", async (_req, res, next) => {
  try {
    const categories = await prisma.$queryRaw<{ id: string; name: string }[]>`
      SELECT id, name
      FROM service_categories
      WHERE status = 'Active'
      ORDER BY name
    `;
    res.json({ success: true, data: categories });
  } catch {
    // Table may not exist yet if admin panel has never been opened; return empty list
    res.json({ success: true, data: [] });
  }
});

// Public — the signup and reset-password forms fetch this before rendering so
// they can show the same rules the API enforces (see passwordPolicy.service).
router.get("/password-policy", async (_req, res, next) => {
  try {
    const policy = await getPasswordPolicy();
    res.json({
      success: true,
      data: { ...policy, requirements: describePasswordPolicy(policy) },
    });
  } catch (err) {
    next(err);
  }
});

export default router;

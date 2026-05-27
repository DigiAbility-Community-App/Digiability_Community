import { Router } from "express";
import { getEvents, getEventById } from "../controllers/event.controller";

const router = Router();

// GET /api/events - Retrieve all events
router.get("/", getEvents);

// GET /api/events/:id - Retrieve details of a single event
router.get("/:id", getEventById);

export default router;

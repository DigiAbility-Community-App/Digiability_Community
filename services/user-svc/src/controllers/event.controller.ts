import { Request, Response, NextFunction } from "express";
import prisma from "../models/prisma.client";

/**
 * What mobile may see: published events whose category is not deactivated in
 * Master Data. Filtering on "not inactive" rather than "is active" keeps
 * legacy rows whose category is free text from before the master-data id
 * backfill — those have no row in event_categories at all.
 */
async function visibleEventsWhere() {
  const inactive = await prisma.eventCategory.findMany({
    where: { status: { not: "Active" } },
    select: { id: true },
  });
  return {
    status: "published",
    ...(inactive.length > 0 ? { category: { notIn: inactive.map((c) => c.id) } } : {}),
  };
}

/**
 * Get all events
 * GET /api/events
 */
export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const events = await prisma.event.findMany({
      where: await visibleEventsWhere(),
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = events.length > limit;
    const result = hasMore ? events.slice(0, limit) : events;

    res.status(200).json({
      success: true,
      data: result,
      pagination: {
        hasMore,
        nextCursor: hasMore ? result[result.length - 1].id : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get event by ID
 * GET /api/events/:id
 */
export async function getEventById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    // Same visibility rule as the feed — a deep link or notification must not
    // open an unpublished event, or one in a deactivated category.
    const event = await prisma.event.findFirst({
      where: { id, ...(await visibleEventsWhere()) },
    });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    next(error);
  }
}

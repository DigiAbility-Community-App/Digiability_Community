import { Request, Response, NextFunction } from "express";
import prisma from "../models/prisma.client";

/**
 * Get all events
 * GET /api/events
 */
export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const cursor = req.query.cursor as string | undefined;

    const events = await prisma.event.findMany({
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

    const event = await prisma.event.findUnique({
      where: { id },
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

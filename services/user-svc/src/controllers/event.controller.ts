import { Request, Response, NextFunction } from "express";
import prisma from "../models/prisma.client";

/**
 * Get all events
 * GET /api/events
 */
export async function getEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const events = await prisma.event.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.status(200).json({
      success: true,
      data: events,
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

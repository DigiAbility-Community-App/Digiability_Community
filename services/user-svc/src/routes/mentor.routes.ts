// ─────────────────────────────────────────────────────────────
// Mentor Routes
//
// REST endpoints for mentor matching, profiles, and reviews.
// All routes require authentication.
// ─────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { z } from 'zod';
import { validate } from '../middleware/validate.middleware';
import { mentorService } from '../services/mentorService';

const router = Router();

// All mentor routes require authentication
router.use(authenticate);

// Helper — extract userId from JWT token (throws if missing — should never happen after authenticate middleware)
const getUserId = (req: Request): string => {
  const id = req.user?.sub;
  if (!id) throw new Error("Authenticated user ID missing from request");
  return id;
};

// ─── Validation Schemas ───────────────────────────────────

const mentorProfileSchema = z.object({
  bio: z.string().max(1000).optional(),
  skills: z.array(z.string().max(100)).max(20).optional(),
  disabilitySpecialties: z.array(z.string().max(100)).max(20).optional(),
  isAvailable: z.boolean().optional(),
});

const mentorReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// ─── Routes ───────────────────────────────────────────────

// GET /api/users/mentors/match — Get matched/suggested mentors for current user
router.get('/match', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const mentors = await mentorService.getMatchedMentors(userId);

    res.json({
      success: true,
      data: mentors,
      count: mentors.length,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch matched mentors',
    });
  }
});

// GET /api/users/mentors/profile/me — Get current user's mentor profile
router.get('/profile/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const profile = await mentorService.getMentorProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found. Create one first.',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch mentor profile',
    });
  }
});

// GET /api/users/mentors/:userId — Get a mentor's public profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await mentorService.getMentorProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Mentor profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch mentor profile',
    });
  }
});

// POST /api/users/mentors/profile — Create or update own mentor profile
router.post('/profile', validate(mentorProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const profile = await mentorService.createOrUpdateProfile(userId, req.body);

    res.status(201).json({
      success: true,
      data: profile,
      message: 'Mentor profile saved successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to save mentor profile',
    });
  }
});

// POST /api/users/mentors/:id/reviews — Submit a review for a mentor
router.post('/:id/reviews', validate(mentorReviewSchema), async (req: Request, res: Response) => {
  try {
    const reviewerId = getUserId(req);
    const mentorId = req.params.id;
    const { rating, comment } = req.body;

    const review = await mentorService.submitReview(mentorId, reviewerId, rating, comment);

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    });
  } catch (error: any) {
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('yourself') ? 400 : 500;
    res.status(status).json({
      success: false,
      message: error.message || 'Failed to submit review',
    });
  }
});

export default router;

// ─────────────────────────────────────────────────────────────
// Mentor Service
//
// Business logic for mentor matching, profiles, and reviews.
// The matching algorithm scores mentors based on:
//   - Disability type match  (+5)
//   - City match             (+4)
//   - State match            (+2)
//   - Average review rating  (×1.5)
// ─────────────────────────────────────────────────────────────

import prisma from '../models/prisma.client';

// Maximum possible score components
const DISABILITY_MATCH_SCORE = 5;
const CITY_MATCH_SCORE = 4;
const STATE_MATCH_SCORE = 2;
const RATING_MULTIPLIER = 1.5;
const MAX_RATING = 5;

// Maximum possible score = disability(5) + city(4) + rating(5 × 1.5 = 7.5) = 16.5
const MAX_POSSIBLE_SCORE = DISABILITY_MATCH_SCORE + CITY_MATCH_SCORE + (MAX_RATING * RATING_MULTIPLIER);

export interface MentorMatchResult {
  mentorId: string;
  userId: string;
  name: string;
  bio: string | null;
  skills: string[];
  disabilitySpecialties: string[];
  city: string | null;
  state: string | null;
  avgRating: number;
  reviewCount: number;
  matchPercentage: number;
  matchScore: number;
}

export const mentorService = {
  /**
   * Get matched/suggested mentors for a user.
   * Scores each available mentor based on disability type, location, and reviews.
   */
  getMatchedMentors: async (userId: string): Promise<MentorMatchResult[]> => {
    // 1. Fetch the requesting user's profile for matching criteria
    const userProfile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { roles: true },
        },
      },
    });

    // Determine the user's disability type (direct or via caregiver)
    const userDisabilityType = userProfile?.disabilityType || userProfile?.careDisabilityType || null;
    const userCity = userProfile?.city || null;
    const userState = userProfile?.state || null;

    // 2. Fetch all available mentor profiles with their reviews and user profiles
    const mentorProfiles = await prisma.mentorProfile.findMany({
      where: {
        isAvailable: true,
        userId: { not: userId }, // Don't match with yourself
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            roles: true,
            userProfile: {
              select: {
                city: true,
                state: true,
              },
            },
          },
        },
        reviews: {
          select: {
            rating: true,
          },
        },
      },
    });

    // 3. Score each mentor
    const results: MentorMatchResult[] = mentorProfiles.map((mentor) => {
      let score = 0;
      const user = mentor.user as any;
      const mentorUserProfile = user?.userProfile;

      // Location: use mentor's UserProfile city/state
      const mentorCity = mentorUserProfile?.city || null;
      const mentorState = mentorUserProfile?.state || null;

      // Disability type match
      if (userDisabilityType && mentor.disabilitySpecialties.length > 0) {
        const normalizedUserType = userDisabilityType.toLowerCase().trim();
        const hasMatch = mentor.disabilitySpecialties.some(
          (s) => s.toLowerCase().trim() === normalizedUserType
        );
        if (hasMatch) score += DISABILITY_MATCH_SCORE;
      }

      // Location match
      if (userCity && mentorCity && userCity.toLowerCase() === mentorCity.toLowerCase()) {
        score += CITY_MATCH_SCORE;
      } else if (userState && mentorState && userState.toLowerCase() === mentorState.toLowerCase()) {
        score += STATE_MATCH_SCORE;
      }

      // Review rating
      const reviewCount = mentor.reviews.length;
      const avgRating = reviewCount > 0
        ? mentor.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;
      score += avgRating * RATING_MULTIPLIER;

      // Calculate match percentage (0-100)
      const matchPercentage = Math.round((score / MAX_POSSIBLE_SCORE) * 100);

      return {
        mentorId: mentor.id,
        userId: mentor.userId,
        name: user.name,
        bio: mentor.bio,
        skills: mentor.skills,
        disabilitySpecialties: mentor.disabilitySpecialties,
        city: mentorCity,
        state: mentorState,
        avgRating: Math.round(avgRating * 10) / 10, // 1 decimal
        reviewCount,
        matchPercentage: Math.min(matchPercentage, 100),
        matchScore: Math.round(score * 10) / 10,
      };
    });

    // 4. Sort by score descending
    results.sort((a, b) => b.matchScore - a.matchScore);

    return results;
  },

  /**
   * Create or update a mentor profile.
   */
  createOrUpdateProfile: async (
    userId: string,
    data: {
      bio?: string;
      skills?: string[];
      disabilitySpecialties?: string[];
      isAvailable?: boolean;
    }
  ) => {
    return prisma.mentorProfile.upsert({
      where: { userId },
      update: {
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.skills !== undefined && { skills: data.skills }),
        ...(data.disabilitySpecialties !== undefined && { disabilitySpecialties: data.disabilitySpecialties }),
        ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
      },
      create: {
        userId,
        bio: data.bio || null,
        skills: data.skills || [],
        disabilitySpecialties: data.disabilitySpecialties || [],
        isAvailable: data.isAvailable ?? true,
      },
      include: {
        reviews: {
          select: { rating: true },
        },
      },
    });
  },

  /**
   * Get a mentor's profile with aggregate review data.
   */
  getMentorProfile: async (userId: string) => {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
          },
          include: {
            userProfile: {
              select: {
                city: true,
                state: true,
                speciality: true,
                yearsOfExperience: true,
              },
            },
          },
        } as any,
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            reviewerId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' as const },
          take: 20,
        },
      },
    });

    if (!mentor) return null;

    const avgRating = mentor.reviews.length > 0
      ? mentor.reviews.reduce((sum, r) => sum + r.rating, 0) / mentor.reviews.length
      : 0;

    return {
      ...mentor,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: mentor.reviews.length,
    };
  },

  /**
   * Submit a review for a mentor.
   * One review per reviewer per mentor (upsert).
   */
  submitReview: async (
    mentorId: string,
    reviewerId: string,
    rating: number,
    comment?: string
  ) => {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Verify mentor exists
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: mentorId },
    });
    if (!mentor) throw new Error('Mentor not found');

    // Cannot review yourself
    if (mentor.userId === reviewerId) {
      throw new Error('You cannot review yourself');
    }

    return prisma.mentorReview.upsert({
      where: {
        mentorId_reviewerId: { mentorId, reviewerId },
      },
      update: {
        rating,
        comment: comment || null,
      },
      create: {
        mentorId,
        reviewerId,
        rating,
        comment: comment || null,
      },
    });
  },
};

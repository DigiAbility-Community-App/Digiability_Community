// ─────────────────────────────────────────────────────
// Data Export Service — DPDP Act 2023 §11 (Right to Access)
//
// Produces a portable JSON bundle of all personal data
// held about the user in user-svc. Data held in chat-svc
// and forum-svc is noted as available on request from
// those services (they maintain separate databases).
//
// Deliberately excludes raw security tokens and hashed
// credentials — these are not portable personal data.
// ─────────────────────────────────────────────────────

import prisma from "../models/prisma.client";

export interface DataExportBundle {
  exportedAt: string;
  userId: string;
  notice: string;
  account: {
    name: string;
    email: string;
    phoneNo: string | null;
    roles: string[];
    isEmailVerified: boolean;
    profileComplete: boolean;
    createdAt: string;
    lastSeen: string | null;
    deletedAt: string | null;
  };
  profile: Record<string, unknown> | null;
  mentorProfile: Record<string, unknown> | null;
  mentorReviewsGiven: Array<Record<string, unknown>>;
  deviceTokens: Array<{ platform: string; registeredAt: string }>;
  consents: Array<Record<string, unknown>>;
  reportsFiled: Array<Record<string, unknown>>;
  crossServiceData: {
    chatService: string;
    forumService: string;
  };
}

export async function exportUserData(userId: string): Promise<DataExportBundle> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNo: true,
      roles: true,
      isEmailVerified: true,
      profileComplete: true,
      createdAt: true,
      lastSeen: true,
      deletedAt: true,
      userProfile: {
        select: {
          username: true,
          fullName: true,
          dob: true,
          gender: true,
          city: true,
          state: true,
          disabilityType: true,
          disabilitySince: true,
          supportNeeded: true,
          carePersonName: true,
          careRelation: true,
          careDob: true,
          careDisabilityType: true,
          speciality: true,
          organization: true,
          yearsOfExperience: true,
          ngoName: true,
          ngoRole: true,
          district: true,
          verificationStatus: true,
          // verificationDoc URL deliberately omitted — not portable personal data
          createdAt: true,
          updatedAt: true,
        },
      },
      mentorProfile: {
        select: {
          bio: true,
          skills: true,
          disabilitySpecialties: true,
          isAvailable: true,
          createdAt: true,
          reviews: {
            select: {
              rating: true,
              comment: true,
              createdAt: true,
              reviewer: { select: { name: true } },
            },
          },
        },
      },
      givenReviews: {
        select: {
          rating: true,
          comment: true,
          createdAt: true,
          mentor: {
            select: { user: { select: { name: true } } },
          },
        },
      },
      deviceTokens: {
        select: { platform: true, createdAt: true },
      },
      consents: {
        select: {
          consentType: true,
          accepted: true,
          version: true,
          acceptedAt: true,
          withdrawnAt: true,
          updatedAt: true,
        },
        orderBy: { consentType: "asc" },
      },
      filedReports: {
        select: {
          targetType: true,
          targetId: true,
          reason: true,
          details: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const { userProfile, mentorProfile, givenReviews, deviceTokens, consents, filedReports, ...account } = user;

  return {
    exportedAt: new Date().toISOString(),
    userId,
    notice:
      "This export contains personal data held by the user-svc. " +
      "Chat messages (chat-svc) and forum posts (forum-svc) are maintained by separate services — " +
      "contact support to request exports from those services.",
    account: {
      name: account.name,
      email: account.email,
      phoneNo: account.phoneNo,
      roles: account.roles,
      isEmailVerified: account.isEmailVerified,
      profileComplete: account.profileComplete,
      createdAt: account.createdAt.toISOString(),
      lastSeen: account.lastSeen?.toISOString() ?? null,
      deletedAt: account.deletedAt?.toISOString() ?? null,
    },
    profile: userProfile
      ? {
          ...userProfile,
          dob: userProfile.dob?.toISOString() ?? null,
          careDob: userProfile.careDob?.toISOString() ?? null,
          createdAt: userProfile.createdAt.toISOString(),
          updatedAt: userProfile.updatedAt.toISOString(),
        }
      : null,
    mentorProfile: mentorProfile
      ? {
          bio: mentorProfile.bio,
          skills: mentorProfile.skills,
          disabilitySpecialties: mentorProfile.disabilitySpecialties,
          isAvailable: mentorProfile.isAvailable,
          createdAt: mentorProfile.createdAt.toISOString(),
          reviewsReceived: mentorProfile.reviews.map((r) => ({
            rating: r.rating,
            comment: r.comment,
            reviewerName: r.reviewer.name,
            createdAt: r.createdAt.toISOString(),
          })),
        }
      : null,
    mentorReviewsGiven: givenReviews.map((r) => ({
      rating: r.rating,
      comment: r.comment,
      mentorName: (r.mentor as any)?.user?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    deviceTokens: deviceTokens.map((t) => ({
      platform: t.platform,
      registeredAt: t.createdAt.toISOString(),
    })),
    consents: consents.map((c) => ({
      consentType: c.consentType,
      accepted: c.accepted,
      policyVersion: c.version,
      acceptedAt: c.acceptedAt?.toISOString() ?? null,
      withdrawnAt: c.withdrawnAt?.toISOString() ?? null,
      lastUpdated: c.updatedAt.toISOString(),
    })),
    reportsFiled: filedReports.map((r) => ({
      targetType: r.targetType,
      targetId: r.targetId,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
    crossServiceData: {
      chatService:
        "Chat messages and group memberships are held by chat-svc. Contact support to request this data.",
      forumService:
        "Forum questions, answers, votes, and bookmarks are held by forum-svc. Contact support to request this data.",
    },
  };
}

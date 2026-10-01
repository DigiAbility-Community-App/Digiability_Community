import prisma from '../models/prisma.client';
import { auditLog } from './audit.service';
import { checkAgeEligibility } from "../utils/age.util";

export type UserRole = 'pwd' | 'caregiver' | 'therapist' | 'ngo' | 'volunteer' | 'student';

// Basic profile payload structure
export interface BasicProfileData {
  username?: string | null;
  fullName?: string | null;
  dob?: string | Date | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
  addressLine1?: string | null;
  streetArea?: string | null;
  pincode?: string | null;
  locationDistrict?: string | null;
  phoneNo?: string | null; // Stored on User model
}

// Role-specific profile details structure
export interface ProfileDetailsData {
  // PwD Fields
  disabilityType?: string | null;
  disabilitySince?: string | number | null;
  supportNeeded?: string | null;

  // Caregiver Fields
  carePersonName?: string | null;
  careRelation?: string | null;
  careDob?: string | Date | null;
  careDisabilityType?: string | null;

  // Therapist Fields
  speciality?: string | null;
  organization?: string | null;
  yearsOfExperience?: string | number | null;

  // NGO Fields
  ngoName?: string | null;
  ngoRole?: string | null;
  district?: string | null;

  // Skill Trainer Fields
  skillsTaught?: string | null;
  teachingMode?: string | null;
  trainingLocation?: string | null;
  trainingAddress?: string | null;

  // Verification
  verificationStatus?: string | null;
  verificationDoc?: string | null;
}

// ─────────────────────────────────────────────
// CHILDREN'S DATA — DPDP Act 2023 §9
//
// §9 prohibits processing personal data of children (< 18) without verifiable
// parental consent, and prohibits behavioural tracking of children entirely.
//
// Digiability is an 18+ platform. Registration now enforces that server-side
// (see the age gate in auth.service.registerUser, and age.util for the rule).
//
// This path handles the remaining case: an account that predates the gate, or
// a profile edit that declares a date of birth making the holder under 18.
// Those are routed to the moderation queue for a human decision rather than
// deleted automatically — the likeliest cause of a surprising date of birth is
// a typo, and terminating an account over one without recourse would be worse
// than the problem. Terms §2 and docs/legal/06 §1.4 describe this.
// ─────────────────────────────────────────────

export async function checkMinorFlag(
  userId: string,
  dob: Date | null | undefined
): Promise<void> {
  if (!dob) return;

  const check = checkAgeEligibility(dob);
  if (check.eligible) return;

  auditLog("auth.underage_flagged_for_review", {
    userId,
    detail: {
      age: check.age,
      reason: check.reason,
      note: "Under-18 account routed to the moderation queue (DPDP §9, Terms §2).",
    },
  });

  // Surface it where moderators actually look. Reusing ModerationFlag rather
  // than inventing a parallel queue means it appears in the existing admin
  // review list with no new plumbing.
  try {
    await prisma.moderationFlag.upsert({
      where: { contentType_contentId: { contentType: "account_age", contentId: userId } },
      update: { status: "PENDING", updatedAt: new Date() },
      create: {
        contentType: "account_age",
        contentId: userId,
        userId,
        text: `Declared date of birth makes this account holder ${check.age} years old. Digiability is 18+.`,
        provider: "age-gate",
        score: 1,
        categories: ["UNDERAGE_ACCOUNT"],
      },
    });
  } catch (err) {
    // Never let a flagging failure block the profile update that triggered it.
    console.error("[checkMinorFlag] failed to raise moderation flag:", err);
  }
}

/**
 * Note that an account holder has declared a minor in their care.
 *
 * Deliberately NOT checkMinorFlag: that flags the account itself as underage,
 * and a caregiver looking after a child is the expected case, not a breach.
 * What DPDP §9 requires here is a recorded guardian attestation, captured on
 * the Care Circle flow — this only leaves an audit trail that the situation
 * exists, so a gap in attestations is discoverable.
 */
async function recordCareRecipientAge(userId: string, careDob: Date): Promise<void> {
  const check = checkAgeEligibility(careDob);
  if (check.eligible) return;

  auditLog("auth.underage_flagged_for_review", {
    userId,
    detail: {
      subject: "care_recipient",
      age: check.age,
      note: "Account holder declared a minor in their care. Guardian attestation required (DPDP §9).",
    },
  });
}

const getStringVal = (val: string | null | undefined): string | null | undefined => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  return val;
};

export const profileService = {
  // Find profile by userId (includes phoneNo from User model)
  findByUserId: async (userId: string) => {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { phoneNo: true },
        },
      },
    });
    if (!profile) return null;
    // Flatten phoneNo onto the profile object for convenience
    const { user, ...rest } = profile as any;
    return { ...rest, phoneNo: user?.phoneNo ?? null };
  },

  // Find profile by username
  findByUsername: async (username: string) => {
    const profile = await prisma.userProfile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            roles: true,
          },
        },
      },
    });
    if (profile && profile.user) {
      (profile.user as any).role = profile.user.roles[0] || null;
    }
    return profile;
  },

  // Create or Update basic profile details
  upsertBasicProfile: async (userId: string, data: BasicProfileData) => {
    let dobVal: Date | null | undefined = undefined;
    if (data.dob !== undefined) {
      if (data.dob === null || data.dob === '') {
        dobVal = null;
      } else {
        const parsed = new Date(data.dob);
        dobVal = isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    const updateData = {
      username: getStringVal(data.username),
      fullName: getStringVal(data.fullName),
      dob: dobVal,
      gender: getStringVal(data.gender),
      city: getStringVal(data.city),
      state: getStringVal(data.state),
      addressLine1: getStringVal(data.addressLine1),
      streetArea: getStringVal(data.streetArea),
      pincode: getStringVal(data.pincode),
      locationDistrict: getStringVal(data.locationDistrict),
    };

    // phoneNo lives on the User model; fullName is mirrored onto User.name so
    // every place that reads User.name (Home tab, chat, forum, admin) sees
    // the latest value — UserProfile.fullName and User.name previously
    // drifted permanently once either onboarding or Edit Profile touched
    // fullName without updating User.name too (confirmed: live accounts
    // already disagree). Only sync fullName when a real value is provided —
    // never overwrite the required User.name with null/undefined.
    const userUpdateData: { phoneNo?: string | null; name?: string } = {};
    if (data.phoneNo !== undefined) {
      userUpdateData.phoneNo = getStringVal(data.phoneNo) ?? null;
    }
    if (updateData.fullName) {
      userUpdateData.name = updateData.fullName;
    }
    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: userUpdateData });
    }

    // The account holder's own date of birth. Under 18 routes the account to the
    // moderation queue — Digiability is 18+ (DPDP §9, Terms §2).
    if (dobVal) await checkMinorFlag(userId, dobVal);

    return prisma.userProfile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        username: getStringVal(data.username) ?? null,
        fullName: getStringVal(data.fullName) ?? null,
        dob: dobVal ?? null,
        gender: getStringVal(data.gender) ?? null,
        city: getStringVal(data.city) ?? null,
        state: getStringVal(data.state) ?? null,
        addressLine1: getStringVal(data.addressLine1) ?? null,
        streetArea: getStringVal(data.streetArea) ?? null,
        pincode: getStringVal(data.pincode) ?? null,
        locationDistrict: getStringVal(data.locationDistrict) ?? null,
      },
    });
  },

  // Create or Update role-specific profile details
  upsertProfileDetails: async (userId: string, data: ProfileDetailsData) => {
    // Parse numeric fields safely
    let disabilitySinceVal: number | null | undefined = undefined;
    if (data.disabilitySince !== undefined) {
      if (data.disabilitySince === null || data.disabilitySince === '') {
        disabilitySinceVal = null;
      } else {
        const parsed = typeof data.disabilitySince === 'string' ? parseInt(data.disabilitySince, 10) : Number(data.disabilitySince);
        disabilitySinceVal = isNaN(parsed) ? null : parsed;
      }
    }

    let yearsOfExperienceVal: number | null | undefined = undefined;
    if (data.yearsOfExperience !== undefined) {
      if (data.yearsOfExperience === null || data.yearsOfExperience === '') {
        yearsOfExperienceVal = null;
      } else {
        const parsed = typeof data.yearsOfExperience === 'string' ? parseInt(data.yearsOfExperience, 10) : Number(data.yearsOfExperience);
        yearsOfExperienceVal = isNaN(parsed) ? null : parsed;
      }
    }

    // Parse dates safely
    let careDobVal: Date | null | undefined = undefined;
    if (data.careDob !== undefined) {
      if (data.careDob === null || data.careDob === '') {
        careDobVal = null;
      } else {
        const parsed = new Date(data.careDob);
        careDobVal = isNaN(parsed.getTime()) ? null : parsed;
      }
    }

    // NOTE: careDob is the date of birth of the person being cared for, NOT the
    // account holder. It must not go through checkMinorFlag — that flags the
    // ACCOUNT as underage, and a caregiver looking after a child is the normal
    // case here, not a violation.
    //
    // A minor in someone's care is the guardian-consent situation (DPDP §9,
    // Terms §2): the guardian attests to the relationship and we record it.
    // That attestation is captured on the Care Circle flow — see
    // GuardianAttestation and docs/legal/06 §1.3.
    if (careDobVal) await recordCareRecipientAge(userId, careDobVal);

    const updateData = {
      disabilityType: getStringVal(data.disabilityType),
      disabilitySince: disabilitySinceVal,
      supportNeeded: getStringVal(data.supportNeeded),

      carePersonName: getStringVal(data.carePersonName),
      careRelation: getStringVal(data.careRelation),
      careDob: careDobVal,
      careDisabilityType: getStringVal(data.careDisabilityType),

      speciality: getStringVal(data.speciality),
      organization: getStringVal(data.organization),
      yearsOfExperience: yearsOfExperienceVal,

      ngoName: getStringVal(data.ngoName),
      ngoRole: getStringVal(data.ngoRole),
      district: getStringVal(data.district),

      skillsTaught: getStringVal(data.skillsTaught),
      teachingMode: getStringVal(data.teachingMode),
      trainingLocation: getStringVal(data.trainingLocation),
      trainingAddress: getStringVal(data.trainingAddress),

      verificationStatus: getStringVal(data.verificationStatus),
      verificationDoc: getStringVal(data.verificationDoc),
    };

    return prisma.userProfile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        disabilityType: getStringVal(data.disabilityType) ?? null,
        disabilitySince: disabilitySinceVal ?? null,
        supportNeeded: getStringVal(data.supportNeeded) ?? null,
        
        carePersonName: getStringVal(data.carePersonName) ?? null,
        careRelation: getStringVal(data.careRelation) ?? null,
        careDob: careDobVal ?? null,
        careDisabilityType: getStringVal(data.careDisabilityType) ?? null,

        speciality: getStringVal(data.speciality) ?? null,
        organization: getStringVal(data.organization) ?? null,
        yearsOfExperience: yearsOfExperienceVal ?? null,

        ngoName: getStringVal(data.ngoName) ?? null,
        ngoRole: getStringVal(data.ngoRole) ?? null,
        district: getStringVal(data.district) ?? null,

        skillsTaught: getStringVal(data.skillsTaught) ?? null,
        teachingMode: getStringVal(data.teachingMode) ?? null,
        trainingLocation: getStringVal(data.trainingLocation) ?? null,
        trainingAddress: getStringVal(data.trainingAddress) ?? null,

        verificationStatus: getStringVal(data.verificationStatus) ?? 'pending',
        verificationDoc: getStringVal(data.verificationDoc) ?? null,
      },
    });
  },

  // Delete profile
  delete: async (userId: string) => {
    return prisma.userProfile.delete({
      where: { userId },
    });
  },

  // Mark profile as complete
  markAsComplete: async (userId: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { profileComplete: true },
    });
  },

  // Check if profile complete
  isProfileComplete: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profileComplete: true },
    });
    return user?.profileComplete ?? false;
  },

  // Get user with profile
  getUserWithProfile: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
      },
    });
  },

  // List verified therapists/educators (for compatibility/therapist lists)
  listVerifiedTherapists: async (filters?: { city?: string; specialty?: string }) => {
    return prisma.userProfile.findMany({
      where: {
        verificationStatus: 'verified',
        user: {
          roles: {
            has: 'therapist',
          },
        },
        ...(filters?.city && { city: filters.city }),
        ...(filters?.specialty && { speciality: filters.specialty }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  },

  // List verified NGOs (for compatibility/NGO lists)
  listVerifiedNGOs: async (filters?: { city?: string }) => {
    return prisma.userProfile.findMany({
      where: {
        verificationStatus: 'verified',
        user: {
          roles: {
            has: 'ngo',
          },
        },
        ...(filters?.city && { city: filters.city }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            roles: true,
          },
        },
      },
    });
  },

  // Update verification status (for Therapist / NGO roles)
  updateVerificationStatus: async (userId: string, status: 'verified' | 'rejected', docUrl?: string) => {
    return prisma.userProfile.update({
      where: { userId },
      data: {
        verificationStatus: status,
        ...(docUrl && { verificationDoc: docUrl }),
      },
    });
  },
};

// ─────────────────────────────────────────────
// COMPATIBILITY EXPORTS FOR BACKWARD COMPATIBILITY
// ─────────────────────────────────────────────

export const pwdProfileService = {
  create: async (userId: string, data: any) => {
    return profileService.upsertProfileDetails(userId, data);
  },
  findByUserId: async (userId: string) => {
    return profileService.findByUserId(userId);
  },
  update: async (userId: string, data: any) => {
    return profileService.upsertProfileDetails(userId, data);
  },
  delete: async (userId: string) => {
    return profileService.delete(userId);
  },
  findByUsername: async (username: string) => {
    return profileService.findByUsername(username);
  },
};

export const caregiverProfileService = {
  create: async (userId: string, data: any) => {
    // Map fields from the old layout
    const mapped = {
      carePersonName: data.careeName,
      careRelation: data.relation,
      careDob: data.careeDob,
      careDisabilityType: data.careDisability,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  findByUserId: async (userId: string) => {
    return profileService.findByUserId(userId);
  },
  update: async (userId: string, data: any) => {
    const mapped = {
      carePersonName: data.careeName,
      careRelation: data.relation,
      careDob: data.careeDob,
      careDisabilityType: data.careDisability,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  delete: async (userId: string) => {
    return profileService.delete(userId);
  },
};

export const therapistProfileService = {
  create: async (userId: string, data: any) => {
    const mapped = {
      speciality: data.specialty,
      organization: data.institution,
      yearsOfExperience: data.yearsOfExperience,
      verificationDoc: data.verificationDoc,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  findByUserId: async (userId: string) => {
    return profileService.findByUserId(userId);
  },
  update: async (userId: string, data: any) => {
    const mapped = {
      speciality: data.specialty,
      organization: data.institution,
      yearsOfExperience: data.yearsOfExperience,
      verificationDoc: data.verificationDoc,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  delete: async (userId: string) => {
    return profileService.delete(userId);
  },
  findByUsername: async (username: string) => {
    return profileService.findByUsername(username);
  },
  listVerified: async (filters?: any) => {
    return profileService.listVerifiedTherapists(filters);
  },
  updateVerificationStatus: async (userId: string, status: 'verified' | 'rejected', docUrl?: string) => {
    return profileService.updateVerificationStatus(userId, status, docUrl);
  },
};

export const ngoProfileService = {
  create: async (userId: string, data: any) => {
    const mapped = {
      ngoName: data.organizationName,
      ngoRole: data.contactPersonName,
      district: data.city,
      verificationDoc: data.verificationDoc,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  findByUserId: async (userId: string) => {
    return profileService.findByUserId(userId);
  },
  update: async (userId: string, data: any) => {
    const mapped = {
      ngoName: data.organizationName,
      ngoRole: data.contactPersonName,
      district: data.city,
      verificationDoc: data.verificationDoc,
    };
    return profileService.upsertProfileDetails(userId, mapped);
  },
  delete: async (userId: string) => {
    return profileService.delete(userId);
  },
  findByUsername: async (username: string) => {
    return profileService.findByUsername(username);
  },
  listVerified: async (filters?: any) => {
    return profileService.listVerifiedNGOs(filters);
  },
  updateVerificationStatus: async (userId: string, status: 'verified' | 'rejected', docUrl?: string) => {
    return profileService.updateVerificationStatus(userId, status, docUrl);
  },
};

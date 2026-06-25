import prisma from '../models/prisma.client';

export type UserRole = 'pwd' | 'caregiver' | 'therapist' | 'ngo' | 'volunteer' | 'student';

// Basic profile payload structure
export interface BasicProfileData {
  username?: string | null;
  fullName?: string | null;
  dob?: string | Date | null;
  gender?: string | null;
  city?: string | null;
  state?: string | null;
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

  // Verification
  verificationStatus?: string | null;
  verificationDoc?: string | null;
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
    };

    // phoneNo lives on the User model — update it separately when provided
    if (data.phoneNo !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { phoneNo: getStringVal(data.phoneNo) ?? null },
      });
    }

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

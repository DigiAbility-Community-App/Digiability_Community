import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type UserRole = 'pwd' | 'caregiver' | 'therapist' | 'ngo' | 'other';

interface CreatePWDProfileRequest {
  username?: string;
  dob?: string | Date;
  disabilityType?: string;
  disabilitySince?: number;
  houseNo?: string;
  street?: string;
  city?: string;
  district?: string;
  state?: string;
}

interface UpdatePWDProfileRequest extends Partial<CreatePWDProfileRequest> {}

interface CreateCaregiverProfileRequest {
  careeName?: string;
  relation?: string;
  careeDob?: string | Date;
  careDisability?: string;
  careSince?: number;
}

interface UpdateCaregiverProfileRequest extends Partial<CreateCaregiverProfileRequest> {}

interface CreateTherapistProfileRequest {
  username?: string;
  dob?: string | Date;
  specialty?: string;
  institution?: string;
  yearsOfExperience?: number;
  focusAreas?: string[];
  city?: string;
  district?: string;
  state?: string;
  verificationDoc?: string;
}

interface UpdateTherapistProfileRequest extends Partial<CreateTherapistProfileRequest> {}

interface CreateNGOProfileRequest {
  contactPersonName?: string;
  username?: string;
  organizationName?: string;
  registrationNumber?: string;
  organizationType?: string;
  servicesOffered?: string[];
  city?: string;
  pincode?: string;
  website?: string;
  verificationDoc?: string;
}

interface UpdateNGOProfileRequest extends Partial<CreateNGOProfileRequest> {}

// ─────────────────────────────────────────────
// PWD PROFILE SERVICE
// ─────────────────────────────────────────────

export const pwdProfileService = {
  create: async (userId: string, data: CreatePWDProfileRequest) => {
    return prisma.pWDProfile.create({
      data: {
        userId,
        ...data,
      },
    });
  },

  findByUserId: async (userId: string) => {
    return prisma.pWDProfile.findUnique({
      where: { userId },
    });
  },

  update: async (userId: string, data: UpdatePWDProfileRequest) => {
    return prisma.pWDProfile.update({
      where: { userId },
      data,
    });
  },

  delete: async (userId: string) => {
    return prisma.pWDProfile.delete({
      where: { userId },
    });
  },

  findByUsername: async (username: string) => {
    return prisma.pWDProfile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  },
};

// ─────────────────────────────────────────────
// CAREGIVER PROFILE SERVICE
// ─────────────────────────────────────────────

export const caregiverProfileService = {
  create: async (userId: string, data: CreateCaregiverProfileRequest) => {
    return prisma.caregiverProfile.create({
      data: {
        userId,
        ...data,
      },
    });
  },

  findByUserId: async (userId: string) => {
    return prisma.caregiverProfile.findUnique({
      where: { userId },
    });
  },

  update: async (userId: string, data: UpdateCaregiverProfileRequest) => {
    return prisma.caregiverProfile.update({
      where: { userId },
      data,
    });
  },

  delete: async (userId: string) => {
    return prisma.caregiverProfile.delete({
      where: { userId },
    });
  },
};

// ─────────────────────────────────────────────
// THERAPIST PROFILE SERVICE
// ─────────────────────────────────────────────

export const therapistProfileService = {
  create: async (userId: string, data: CreateTherapistProfileRequest) => {
    return prisma.therapistProfile.create({
      data: {
        userId,
        focusAreas: data.focusAreas || [],
        verificationStatus: 'pending',
        ...data,
      },
    });
  },

  findByUserId: async (userId: string) => {
    return prisma.therapistProfile.findUnique({
      where: { userId },
    });
  },

  update: async (userId: string, data: UpdateTherapistProfileRequest) => {
    return prisma.therapistProfile.update({
      where: { userId },
      data: {
        ...data,
        focusAreas: data.focusAreas || undefined,
      },
    });
  },

  delete: async (userId: string) => {
    return prisma.therapistProfile.delete({
      where: { userId },
    });
  },

  findByUsername: async (username: string) => {
    return prisma.therapistProfile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  listVerified: async (filters?: { city?: string; specialty?: string; focusArea?: string }) => {
    return prisma.therapistProfile.findMany({
      where: {
        verificationStatus: 'verified',
        ...(filters?.city && { city: filters.city }),
        ...(filters?.specialty && { specialty: filters.specialty }),
        ...(filters?.focusArea && {
          focusAreas: {
            has: filters.focusArea,
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  },

  updateVerificationStatus: async (userId: string, status: 'verified' | 'rejected', docUrl?: string) => {
    return prisma.therapistProfile.update({
      where: { userId },
      data: {
        verificationStatus: status,
        ...(docUrl && { verificationDoc: docUrl }),
      },
    });
  },
};

// ─────────────────────────────────────────────
// NGO PROFILE SERVICE
// ─────────────────────────────────────────────

export const ngoProfileService = {
  create: async (userId: string, data: CreateNGOProfileRequest) => {
    return prisma.nGOProfile.create({
      data: {
        userId,
        servicesOffered: data.servicesOffered || [],
        verificationStatus: 'pending',
        ...data,
      },
    });
  },

  findByUserId: async (userId: string) => {
    return prisma.nGOProfile.findUnique({
      where: { userId },
    });
  },

  update: async (userId: string, data: UpdateNGOProfileRequest) => {
    return prisma.nGOProfile.update({
      where: { userId },
      data: {
        ...data,
        servicesOffered: data.servicesOffered || undefined,
      },
    });
  },

  delete: async (userId: string) => {
    return prisma.nGOProfile.delete({
      where: { userId },
    });
  },

  findByUsername: async (username: string) => {
    return prisma.nGOProfile.findUnique({
      where: { username },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  },

  listVerified: async (filters?: { city?: string; service?: string }) => {
    return prisma.nGOProfile.findMany({
      where: {
        verificationStatus: 'verified',
        ...(filters?.city && { city: filters.city }),
        ...(filters?.service && {
          servicesOffered: {
            has: filters.service,
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });
  },

  updateVerificationStatus: async (userId: string, status: 'verified' | 'rejected', docUrl?: string) => {
    return prisma.nGOProfile.update({
      where: { userId },
      data: {
        verificationStatus: status,
        ...(docUrl && { verificationDoc: docUrl }),
      },
    });
  },
};

// ─────────────────────────────────────────────
// GENERIC PROFILE SERVICE
// ─────────────────────────────────────────────

export const profileService = {
  getProfileByRole: async (userId: string, role: UserRole) => {
    switch (role) {
      case 'pwd':
        return pwdProfileService.findByUserId(userId);
      case 'caregiver':
        return caregiverProfileService.findByUserId(userId);
      case 'therapist':
        return therapistProfileService.findByUserId(userId);
      case 'ngo':
        return ngoProfileService.findByUserId(userId);
      default:
        return null;
    }
  },

  isProfileComplete: async (userId: string) => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, profileComplete: true },
    });
    return user?.profileComplete ?? false;
  },

  markAsComplete: async (userId: string) => {
    return prisma.user.update({
      where: { id: userId },
      data: { profileComplete: true },
    });
  },

  getUserWithProfile: async (userId: string) => {
    return prisma.user.findUnique({
      where: { id: userId },
      include: {
        pwdProfile: true,
        caregiverProfile: true,
        therapistProfile: true,
        ngoProfile: true,
      },
    });
  },
};

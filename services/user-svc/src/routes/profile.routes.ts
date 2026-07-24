import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';
import {
  pwdProfileService,
  caregiverProfileService,
  therapistProfileService,
  ngoProfileService,
  profileService,
} from '../services/profileService';
import { auditLog } from '../services/audit.service';

const router = Router();

// Ensure all profile routes are authenticated
router.use(authenticate);

// Extract userId from token — throws 401 if missing rather than returning empty string
const getUserIdFromAuthToken = (req: Request): string => {
  const sub = req.user?.sub;
  if (!sub) {
    const err: any = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  return sub;
};

// ─────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────

const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

const basicProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(USERNAME_REGEX, 'Username may only contain lowercase letters, numbers, underscores, and dots')
    .optional(),
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  addressLine1: z.string().max(200).optional(),
  streetArea: z.string().max(200).optional(),
  pincode: z.string().max(20).optional(),
  locationDistrict: z.string().max(100).optional(),
  phoneNo: z.string().max(20, 'Phone number is too long').optional(),
});

const profileDetailsSchema = z.object({
  // PwD Fields
  disabilityType: z.string().optional(),
  disabilitySince: z.number().optional().or(z.string().optional()),
  supportNeeded: z.string().optional(),

  // Caregiver Fields
  carePersonName: z.string().optional(),
  careRelation: z.string().optional(),
  careDob: z.string().optional(),
  careDisabilityType: z.string().optional(),

  // Therapist Fields
  speciality: z.string().optional(),
  organization: z.string().optional(),
  yearsOfExperience: z.number().optional().or(z.string().optional()),

  // NGO Fields
  ngoName: z.string().optional(),
  ngoRole: z.string().optional(),
  district: z.string().optional(),

  // Verification
  verificationStatus: z.string().optional(),
  verificationDoc: z.string().optional(),

  // Optional: pass roles from the client to avoid an extra DB round-trip when checking completion
  roles: z.array(z.string()).optional(),
});

const pwdProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  dob: z.string().optional(),
  disabilityType: z.string().optional(),
  disabilitySince: z.number().min(1900).max(new Date().getFullYear()).optional(),
  houseNo: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
});

const caregiverProfileSchema = z.object({
  careeName: z.string().optional(),
  relation: z.string().optional(),
  careeDob: z.string().optional(),
  careDisability: z.string().optional(),
  careSince: z.number().min(1900).max(new Date().getFullYear()).optional(),
});

const therapistProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  dob: z.string().optional(),
  specialty: z.string().optional(),
  institution: z.string().optional(),
  yearsOfExperience: z.number().min(0).optional(),
  focusAreas: z.array(z.string()).optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  verificationDoc: z.string().url().optional(),
});

const ngoProfileSchema = z.object({
  contactPersonName: z.string().optional(),
  username: z.string().min(3).max(20).optional(),
  organizationName: z.string().optional(),
  registrationNumber: z.string().optional(),
  organizationType: z.string().optional(),
  servicesOffered: z.array(z.string()).optional(),
  city: z.string().optional(),
  pincode: z.string().optional(),
  website: z.string().url().optional(),
  verificationDoc: z.string().url().optional(),
});

// ─────────────────────────────────────────────
// UNIFIED PROFILE ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/users/profile/check-username?username=... - Real-time availability check
router.get('/check-username', async (req: Request, res: Response) => {
  try {
    const username = (req.query.username as string ?? '').toLowerCase().trim();

    if (!username || !USERNAME_REGEX.test(username)) {
      return res.status(400).json({
        success: false,
        available: false,
        message: 'Invalid username format. Use 3–20 lowercase letters, numbers, underscores, or dots.',
      });
    }

    const userId = getUserIdFromAuthToken(req);
    const existing = await profileService.findByUsername(username);
    const available = !existing || existing.userId === userId;

    return res.json({
      success: true,
      available,
      message: available ? 'Username is available' : 'Username is already taken',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to check username' });
  }
});

// POST /api/users/profile - Create basic profile
router.post('/', validate(basicProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);

    // Check username uniqueness if provided
    if (req.body.username) {
      const existingUsername = await profileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const isNew = !(await profileService.findByUserId(userId));
    const profile = await profileService.upsertBasicProfile(userId, req.body);
    res.status(isNew ? 201 : 200).json({
      success: true,
      data: profile,
      message: isNew ? 'Basic profile created successfully' : 'Basic profile updated successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      success: false,
      message: error.message || 'Failed to create basic profile',
    });
  }
});

// PUT /api/users/profile - Update basic profile (Right to Correction — DPDP §12)
router.put('/', validate(basicProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);

    // Check username uniqueness if provided
    if (req.body.username) {
      const existingUsername = await profileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await profileService.upsertBasicProfile(userId, req.body);

    auditLog("privacy.correction_requested", {
      userId,
      detail: { fields: Object.keys(req.body) },
    });

    res.json({
      success: true,
      data: profile,
      message: 'Basic profile updated successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      success: false,
      message: error.message || 'Failed to update basic profile',
    });
  }
});

// Helper — check whether role-specific required fields are provided for markAsComplete
function hasRequiredRoleFields(roles: string[] | string | undefined | null, body: Record<string, any>): boolean {
  if (!roles) return false;
  const rolesArr = Array.isArray(roles) ? roles : [roles];
  if (rolesArr.length === 0) return false;
  return rolesArr.every(role => {
    switch (role) {
      case 'pwd':       return !!body.disabilityType;
      case 'caregiver': return !!body.carePersonName;
      case 'therapist': return !!body.speciality;
      case 'ngo':       return !!body.ngoName;
      // volunteer and student have no required role-specific fields
      case 'volunteer':
      case 'student':   return true;
      default:          return false;
    }
  });
}

// POST /api/users/profile/details - Create/update role-specific profile details
router.post('/details', validate(profileDetailsSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    // `roles` may be present in the body in whatever label dialect the
    // calling client uses (e.g. frontend "educator" vs backend "therapist")
    // — always ignore it and read the authoritative, already-backend-mapped
    // value from the DB instead. Trusting the client value here previously
    // caused profileComplete to silently never get set for any role beyond
    // pwd/caregiver (the two labels that happen to match both dialects).
    const { roles: _bodyRoles, ...detailsData } = req.body;
    const profile = await profileService.upsertProfileDetails(userId, detailsData);

    const userRecord = await profileService.getUserWithProfile(userId);
    if (hasRequiredRoleFields(userRecord?.roles, req.body)) {
      await profileService.markAsComplete(userId);
    }

    res.status(201).json({
      success: true,
      data: profile,
      message: 'Profile details saved successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      success: false,
      message: error.message || 'Failed to save profile details',
    });
  }
});

// PUT /api/users/profile/details - Update role-specific profile details (Right to Correction — DPDP §12)
router.put('/details', validate(profileDetailsSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    // See the POST handler above for why bodyRoles is intentionally ignored.
    const { roles: _bodyRoles, ...detailsData } = req.body;
    const profile = await profileService.upsertProfileDetails(userId, detailsData);

    const userRecord = await profileService.getUserWithProfile(userId);
    if (hasRequiredRoleFields(userRecord?.roles, req.body)) {
      await profileService.markAsComplete(userId);
    }

    auditLog("privacy.correction_requested", {
      userId,
      detail: { fields: Object.keys(detailsData) },
    });

    res.json({
      success: true,
      data: profile,
      message: 'Profile details updated successfully',
    });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      success: false,
      message: error.message || 'Failed to update profile details',
    });
  }
});

// GET /api/users/profile/me - Get current user's profile
router.get('/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await profileService.findByUserId(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }
    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({
      success: false,
      message: error.message || 'Failed to fetch profile',
    });
  }
});

// ─────────────────────────────────────────────
// COMPATIBILITY ENDPOINTS (PWD)
// ─────────────────────────────────────────────

router.post('/pwd', validate(pwdProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    if (req.body.username) {
      const existingUsername = await pwdProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }
    const profile = await pwdProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/pwd/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await pwdProfileService.findByUserId(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/pwd/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const profile = await pwdProfileService.findByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.put('/pwd/:userId', validate(pwdProfileSchema), async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    const { userId } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (req.body.username) {
      const existingUsername = await pwdProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
      }
    }
    const profile = await pwdProfileService.update(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.delete('/pwd/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await pwdProfileService.delete(req.params.userId);
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// COMPATIBILITY ENDPOINTS (CAREGIVER)
// ─────────────────────────────────────────────

router.post('/caregiver', validate(caregiverProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await caregiverProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/caregiver/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await caregiverProfileService.findByUserId(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/caregiver/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const profile = await caregiverProfileService.findByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.put('/caregiver/:userId', validate(caregiverProfileSchema), async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const profile = await caregiverProfileService.update(req.params.userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.delete('/caregiver/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await caregiverProfileService.delete(req.params.userId);
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// COMPATIBILITY ENDPOINTS (THERAPIST)
// ─────────────────────────────────────────────

router.post('/therapist', validate(therapistProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    if (req.body.username) {
      const existingUsername = await therapistProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
      }
    }
    const profile = await therapistProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/therapist/list/verified', async (req: Request, res: Response) => {
  try {
    const { city, specialty } = req.query;
    const profiles = await therapistProfileService.listVerified({
      city: city as string,
      specialty: specialty as string,
    });
    res.json({ success: true, data: profiles });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/therapist/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await therapistProfileService.findByUserId(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/therapist/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const profile = await therapistProfileService.findByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.put('/therapist/:userId', validate(therapistProfileSchema), async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    const { userId } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (req.body.username) {
      const existingUsername = await therapistProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
      }
    }
    const profile = await therapistProfileService.update(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.delete('/therapist/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await therapistProfileService.delete(req.params.userId);
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

// ─────────────────────────────────────────────
// COMPATIBILITY ENDPOINTS (NGO)
// ─────────────────────────────────────────────

router.post('/ngo', validate(ngoProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    if (req.body.username) {
      const existingUsername = await ngoProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
      }
    }
    const profile = await ngoProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    res.status(201).json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/ngo/list/verified', async (req: Request, res: Response) => {
  try {
    const { city } = req.query;
    const profiles = await ngoProfileService.listVerified({
      city: city as string,
    });
    res.json({ success: true, data: profiles });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/ngo/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await ngoProfileService.findByUserId(userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.get('/ngo/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const profile = await ngoProfileService.findByUserId(req.params.userId);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.put('/ngo/:userId', validate(ngoProfileSchema), async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    const { userId } = req.params;
    if (requesterId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (req.body.username) {
      const existingUsername = await ngoProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({ success: false, message: 'Username already taken' });
      }
    }
    const profile = await ngoProfileService.update(userId, req.body);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

router.delete('/ngo/:userId', async (req: Request, res: Response) => {
  try {
    const requesterId = getUserIdFromAuthToken(req);
    if (requesterId !== req.params.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await ngoProfileService.delete(req.params.userId);
    res.json({ success: true, message: 'Profile deleted successfully' });
  } catch (error: any) {
    res.status(error.statusCode ?? 500).json({ success: false, message: error.message });
  }
});

export default router;

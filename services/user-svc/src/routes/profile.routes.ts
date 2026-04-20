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

const router = Router();

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────

// Ensure all profile routes are authenticated
router.use(authenticate);

// Extract userId from token (set by authenticateToken middleware)
const getUserIdFromAuthToken = (req: Request): string => {
  return req.user?.sub ?? '';
};

// ─────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────

const pwdProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  dob: z.string().datetime().optional(),
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
  careeDob: z.string().datetime().optional(),
  careDisability: z.string().optional(),
  careSince: z.number().min(1900).max(new Date().getFullYear()).optional(),
});

const therapistProfileSchema = z.object({
  username: z.string().min(3).max(20).optional(),
  dob: z.string().datetime().optional(),
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
// PWD PROFILE ROUTES
// ─────────────────────────────────────────────

// POST /api/users/profiles/pwd - Create PWD profile
router.post('/pwd', validate(pwdProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    
    // Check if profile already exists
    const existingProfile = await pwdProfileService.findByUserId(userId);
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'PWD profile already exists for this user',
      });
    }

    // Check username uniqueness
    if (req.body.username) {
      const existingUsername = await pwdProfileService.findByUsername(req.body.username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await pwdProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'PWD profile created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create PWD profile',
    });
  }
});

// GET /api/users/profiles/pwd/me - Get current user's PWD profile
router.get('/pwd/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await pwdProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'PWD profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch PWD profile',
    });
  }
});

// GET /api/users/profiles/pwd/:userId - Get PWD profile by user ID
router.get('/pwd/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await pwdProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'PWD profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch PWD profile',
    });
  }
});

// PUT /api/users/profiles/pwd/:userId - Update PWD profile
router.put('/pwd/:userId', validate(pwdProfileSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    // Allow only self-update or admin
    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile',
      });
    }

    // Check username uniqueness (if changing)
    if (req.body.username) {
      const existingUsername = await pwdProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await pwdProfileService.update(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.json({
      success: true,
      data: profile,
      message: 'PWD profile updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update PWD profile',
    });
  }
});

// DELETE /api/users/profiles/pwd/:userId - Delete PWD profile
router.delete('/pwd/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile',
      });
    }

    await pwdProfileService.delete(userId);
    
    res.json({
      success: true,
      message: 'PWD profile deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete PWD profile',
    });
  }
});

// ─────────────────────────────────────────────
// CAREGIVER PROFILE ROUTES
// ─────────────────────────────────────────────

// POST /api/users/profiles/caregiver - Create caregiver profile
router.post('/caregiver', validate(caregiverProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    
    const existingProfile = await caregiverProfileService.findByUserId(userId);
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'Caregiver profile already exists for this user',
      });
    }

    const profile = await caregiverProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Caregiver profile created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create caregiver profile',
    });
  }
});

// GET /api/users/profiles/caregiver/me - Get current user's caregiver profile
router.get('/caregiver/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await caregiverProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch caregiver profile',
    });
  }
});

// GET /api/users/profiles/caregiver/:userId - Get caregiver profile by user ID
router.get('/caregiver/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await caregiverProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Caregiver profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch caregiver profile',
    });
  }
});

// PUT /api/users/profiles/caregiver/:userId - Update caregiver profile
router.put('/caregiver/:userId', validate(caregiverProfileSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile',
      });
    }

    const profile = await caregiverProfileService.update(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.json({
      success: true,
      data: profile,
      message: 'Caregiver profile updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update caregiver profile',
    });
  }
});

// DELETE /api/users/profiles/caregiver/:userId - Delete caregiver profile
router.delete('/caregiver/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile',
      });
    }

    await caregiverProfileService.delete(userId);
    
    res.json({
      success: true,
      message: 'Caregiver profile deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete caregiver profile',
    });
  }
});

// ─────────────────────────────────────────────
// THERAPIST PROFILE ROUTES
// ─────────────────────────────────────────────

// POST /api/users/profiles/therapist - Create therapist profile
router.post('/therapist', validate(therapistProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    
    const existingProfile = await therapistProfileService.findByUserId(userId);
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'Therapist profile already exists for this user',
      });
    }

    if (req.body.username) {
      const existingUsername = await therapistProfileService.findByUsername(req.body.username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await therapistProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'Therapist profile created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create therapist profile',
    });
  }
});

// GET /api/users/profiles/therapist/me - Get current user's therapist profile
router.get('/therapist/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await therapistProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch therapist profile',
    });
  }
});

// GET /api/users/profiles/therapist/:userId - Get therapist profile by user ID
router.get('/therapist/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await therapistProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Therapist profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch therapist profile',
    });
  }
});

// PUT /api/users/profiles/therapist/:userId - Update therapist profile
router.put('/therapist/:userId', validate(therapistProfileSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile',
      });
    }

    if (req.body.username) {
      const existingUsername = await therapistProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await therapistProfileService.update(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.json({
      success: true,
      data: profile,
      message: 'Therapist profile updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update therapist profile',
    });
  }
});

// DELETE /api/users/profiles/therapist/:userId - Delete therapist profile
router.delete('/therapist/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile',
      });
    }

    await therapistProfileService.delete(userId);
    
    res.json({
      success: true,
      message: 'Therapist profile deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete therapist profile',
    });
  }
});

// GET /api/users/profiles/therapist/list/verified - List verified therapists
router.get('/therapist/list/verified', async (req: Request, res: Response) => {
  try {
    const { city, specialty, focusArea } = req.query;
    
    const profiles = await therapistProfileService.listVerified({
      city: city as string,
      specialty: specialty as string,
      focusArea: focusArea as string,
    });

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch therapist list',
    });
  }
});

// ─────────────────────────────────────────────
// NGO PROFILE ROUTES
// ─────────────────────────────────────────────

// POST /api/users/profiles/ngo - Create NGO profile
router.post('/ngo', validate(ngoProfileSchema), async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    
    const existingProfile = await ngoProfileService.findByUserId(userId);
    if (existingProfile) {
      return res.status(409).json({
        success: false,
        message: 'NGO profile already exists for this user',
      });
    }

    if (req.body.username) {
      const existingUsername = await ngoProfileService.findByUsername(req.body.username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await ngoProfileService.create(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.status(201).json({
      success: true,
      data: profile,
      message: 'NGO profile created successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create NGO profile',
    });
  }
});

// GET /api/users/profiles/ngo/me - Get current user's NGO profile
router.get('/ngo/me', async (req: Request, res: Response) => {
  try {
    const userId = getUserIdFromAuthToken(req);
    const profile = await ngoProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'NGO profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch NGO profile',
    });
  }
});

// GET /api/users/profiles/ngo/:userId - Get NGO profile by user ID
router.get('/ngo/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const profile = await ngoProfileService.findByUserId(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'NGO profile not found',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch NGO profile',
    });
  }
});

// PUT /api/users/profiles/ngo/:userId - Update NGO profile
router.put('/ngo/:userId', validate(ngoProfileSchema), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this profile',
      });
    }

    if (req.body.username) {
      const existingUsername = await ngoProfileService.findByUsername(req.body.username);
      if (existingUsername && existingUsername.userId !== userId) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken',
        });
      }
    }

    const profile = await ngoProfileService.update(userId, req.body);
    await profileService.markAsComplete(userId);
    
    res.json({
      success: true,
      data: profile,
      message: 'NGO profile updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update NGO profile',
    });
  }
});

// DELETE /api/users/profiles/ngo/:userId - Delete NGO profile
router.delete('/ngo/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const authUserId = getUserIdFromAuthToken(req);

    if (userId !== authUserId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this profile',
      });
    }

    await ngoProfileService.delete(userId);
    
    res.json({
      success: true,
      message: 'NGO profile deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete NGO profile',
    });
  }
});

// GET /api/users/profiles/ngo/list/verified - List verified NGOs
router.get('/ngo/list/verified', async (req: Request, res: Response) => {
  try {
    const { city, service } = req.query;
    
    const profiles = await ngoProfileService.listVerified({
      city: city as string,
      service: service as string,
    });

    res.json({
      success: true,
      data: profiles,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch NGO list',
    });
  }
});

export default router;

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

export enum UserRole {
  PWD = 'pwd',
  CAREGIVER = 'caregiver',
  THERAPIST = 'therapist',
  NGO = 'ngo',
  OTHER = 'other',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

// ─────────────────────────────────────────────
// BASE USER
// ─────────────────────────────────────────────

export interface BaseUser {
  id: string;
  name: string;
  email: string;
  phoneNo?: string | null;
  lastSeen?: Date | null;
  isEmailVerified: boolean;
  role?: UserRole | null;
  roles?: UserRole[];
  profileComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends BaseUser {
  // No password field exposed to frontend
}

// ─────────────────────────────────────────────
// PWD PROFILE (Person with Disability)
// ─────────────────────────────────────────────

export interface PWDProfileData {
  username?: string | null;
  dob?: Date | null;
  disabilityType?: string | null;
  disabilitySince?: number | null; // Year
  houseNo?: string | null;
  street?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
}

export interface PWDProfile extends PWDProfileData {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePWDProfileRequest extends PWDProfileData {}

export interface UpdatePWDProfileRequest extends Partial<PWDProfileData> {}

// ─────────────────────────────────────────────
// CAREGIVER PROFILE (Parent/Caregiver)
// ─────────────────────────────────────────────

export interface CaregiverProfileData {
  careeName?: string | null;
  relation?: string | null; // Son, Daughter, Father, Mother, Sibling, etc.
  careeDob?: Date | null;
  careDisability?: string | null;
  careSince?: number | null; // Year
}

export interface CaregiverProfile extends CaregiverProfileData {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCaregiverProfileRequest extends CaregiverProfileData {}

export interface UpdateCaregiverProfileRequest extends Partial<CaregiverProfileData> {}

// ─────────────────────────────────────────────
// THERAPIST PROFILE (Educator/Therapist)
// ─────────────────────────────────────────────

export enum DisabilityFocus {
  VISUAL = 'Visual',
  HEARING = 'Hearing',
  PHYSICAL = 'Physical',
  COGNITIVE = 'Cognitive',
  MULTIPLE = 'Multiple',
}

export interface TherapistProfileData {
  username?: string | null;
  dob?: Date | null;
  specialty?: string | null;
  institution?: string | null;
  yearsOfExperience?: number | null;
  focusAreas?: DisabilityFocus[] | string[];
  city?: string | null;
  district?: string | null;
  state?: string | null;
  verificationDoc?: string | null;
}

export interface TherapistProfile extends TherapistProfileData {
  id: string;
  userId: string;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTherapistProfileRequest extends TherapistProfileData {}

export interface UpdateTherapistProfileRequest extends Partial<TherapistProfileData> {}

// ─────────────────────────────────────────────
// NGO PROFILE (Organization)
// ─────────────────────────────────────────────

export enum ServiceOffered {
  THERAPY = 'Therapy',
  EDUCATION = 'Education',
  TRAINING = 'Training',
  ASSISTIVE_TECH = 'Assistive Tech',
  COUNSELLING = 'Counselling',
  OTHER = 'Other',
}

export enum OrganizationType {
  TRUST = 'Trust',
  NGO = 'NGO',
  FOUNDATION = 'Foundation',
  COMPANY = 'Company',
  GOVERNMENT = 'Government',
  EDUCATIONAL = 'Educational Institution',
  OTHER = 'Other',
}

export interface NGOProfileData {
  contactPersonName?: string | null;
  username?: string | null;
  organizationName?: string | null;
  registrationNumber?: string | null;
  organizationType?: string | null;
  servicesOffered?: ServiceOffered[] | string[];
  city?: string | null;
  pincode?: string | null;
  website?: string | null;
  verificationDoc?: string | null;
}

export interface NGOProfile extends NGOProfileData {
  id: string;
  userId: string;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNGOProfileRequest extends NGOProfileData {}

export interface UpdateNGOProfileRequest extends Partial<NGOProfileData> {}

// ─────────────────────────────────────────────
// UNION TYPES
// ─────────────────────────────────────────────

export type AnyProfile = PWDProfile | CaregiverProfile | TherapistProfile | NGOProfile;

export type CreateProfileRequest =
  | CreatePWDProfileRequest
  | CreateCaregiverProfileRequest
  | CreateTherapistProfileRequest
  | CreateNGOProfileRequest;

export type UpdateProfileRequest =
  | UpdatePWDProfileRequest
  | UpdateCaregiverProfileRequest
  | UpdateTherapistProfileRequest
  | UpdateNGOProfileRequest;

// ─────────────────────────────────────────────
// COMBINED USER + PROFILE
// ─────────────────────────────────────────────

export interface UserWithPWDProfile extends User {
  pwdProfile?: PWDProfile | null;
}

export interface UserWithCaregiverProfile extends User {
  caregiverProfile?: CaregiverProfile | null;
}

export interface UserWithTherapistProfile extends User {
  therapistProfile?: TherapistProfile | null;
}

export interface UserWithNGOProfile extends User {
  ngoProfile?: NGOProfile | null;
}

export type UserWithProfile = 
  | UserWithPWDProfile 
  | UserWithCaregiverProfile 
  | UserWithTherapistProfile 
  | UserWithNGOProfile;

// ─────────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────────

export interface GetProfileResponse {
  success: boolean;
  data?: AnyProfile | null;
  message: string;
}

export interface CreateProfileResponse {
  success: boolean;
  data?: AnyProfile;
  message: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  data?: AnyProfile;
  message: string;
}

export interface GetUserWithProfileResponse {
  success: boolean;
  data?: UserWithProfile;
  message: string;
}

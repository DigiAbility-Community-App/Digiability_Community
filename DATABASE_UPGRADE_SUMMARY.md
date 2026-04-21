# Database Upgrade Summary

Quick reference for all database and backend changes made to support role-based user profiles.

---

## 📊 Database Architecture

### User Roles
```
User
├── PWD (Person with Disability)
├── Caregiver (Parent/Guardian)
├── Therapist (Educator)
└── NGO (Organization)
```

### Entity Relationship Diagram

```
┌──────────────────────────┐
│        User              │
├──────────────────────────┤
│ id (PK)                  │
│ email                    │
│ name                     │
│ role                     │
│ profileComplete          │
│ createdAt, updatedAt     │
└────────┬─────┬───────┬───┘
         │     │       │
    ┌────▼┐ ┌──▼──┐ ┌──▼──┐ ┌──────────┐
    │  1:1 │ │ 1:1 │ │ 1:1 │ │   1:1    │
    │     │ │     │ │     │ │          │
  ┌─▼────────────────────────────────────────┐
  │ PWDProfile          CaregiverProfile       │
  ├──────────┬──────────────┬─────────────────┤
  │ id       │ id           │ id              │
  │ userId   │ userId       │ userId          │
  │ username │ careeName    │ username        │
  │ dob      │ relation     │ dob             │
  │ disability                     specialty  │
  │ Since    │ careeDob     │ institution     │
  │ address  │ careDisability exper       │
  │          │ careSince    │ focusAreas      │
  │          │              │ location        │
  │          │              │ verification... │
  └──────────┴──────────────┴─────────────────┘
  
  ┌──────────────────────────────────────────┐
  │  TherapistProfile    NGOProfile           │
  ├─────────────────┬────────────────────────┤
  │ (documented above)                       │
  └──────────────────────────────────────────┘
```

---

## 📝 Files Created

### 1. **Prisma Schema Update**
```
services/user-svc/prisma/schema.prisma
```
- Added 4 profile models: PWDProfile, CaregiverProfile, TherapistProfile, NGOProfile
- Added `role` and `profileComplete` fields to User model
- Added relations from User to all profile models

### 2. **Database Migration**
```
services/user-svc/prisma/migrations/20260420_add_user_profiles/migration.sql
```
Contains:
- ALTER TABLE users (add `role`, `profileComplete`)
- CREATE TABLE pwd_profiles
- CREATE TABLE caregiver_profiles
- CREATE TABLE therapist_profiles
- CREATE TABLE ngo_profiles
- All indexes and foreign keys

### 3. **Backend Services**
```
services/user-svc/src/services/profileService.ts
```
Services for:
- `pwdProfileService` - CRUD for PWD profiles
- `caregiverProfileService` - CRUD for Caregiver profiles
- `therapistProfileService` - CRUD + verification + list for Therapist profiles
- `ngoProfileService` - CRUD + verification + list for NGO profiles
- `profileService` - Generic profile operations

### 4. **Backend Routes**
```
services/user-svc/src/routes/profile.routes.ts
```
Endpoints:
- `/pwd` - Create, read, update, delete PWD profile
- `/caregiver` - Create, read, update, delete Caregiver profile
- `/therapist` - Create, read, update, delete, list Therapist profile
- `/ngo` - Create, read, update, delete, list NGO profile

### 5. **TypeScript Types**
```
packages/types/src/user.types.ts
```
Types for:
- Enums: UserRole, VerificationStatus, DisabilityFocus, ServiceOffered, OrganizationType
- User: User, BaseUser
- PWD Profile: PWDProfile, PWDProfileData, CreatePWDProfileRequest, UpdatePWDProfileRequest
- Caregiver Profile: CaregiverProfile, CaregiverProfileData, etc.
- Therapist Profile: TherapistProfile, TherapistProfileData, etc.
- NGO Profile: NGOProfile, NGOProfileData, etc.
- Union types and API responses

### 6. **API Client Functions**
```
packages/api/src/user.api.ts
```
Functions for:
- `userApi` - User CRUD operations
- `pwdProfileApi` - PWD profile API calls
- `caregiverProfileApi` - Caregiver profile API calls
- `therapistProfileApi` - Therapist profile API calls
- `ngoProfileApi` - NGO profile API calls
- `profileApi` - Generic profile operations

### 7. **Documentation Files**
```
docs/PROFILE_DATABASE_UPGRADE.md
FRONTEND_INTEGRATION_GUIDE.md
setup-profiles.sh
```

---

## 🔧 Files Modified

| File | Changes |
|------|---------|
| `services/user-svc/src/index.ts` | Added profile routes mounting |
| `services/user-svc/prisma/schema.prisma` | Added profile models and User updates |
| `packages/types/src/index.ts` | Exported profile types |
| `packages/api/src/index.ts` | Exported profile API functions |
| `packages/api/src/client.ts` | Created (was empty) |

---

## 📋 Database Schema Summary

### Table 1: pwd_profiles
```
Columns:
- id (UUID, PK)
- userId (UUID, FK, UNIQUE)
- username (String, UNIQUE, nullable)
- dob (DateTime, nullable)
- disabilityType (String, nullable)
- disabilitySince (Integer, nullable)
- houseNo (String, nullable)
- street (String, nullable)
- city (String, nullable)
- district (String, nullable)
- state (String, nullable)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### Table 2: caregiver_profiles
```
Columns:
- id (UUID, PK)
- userId (UUID, FK, UNIQUE)
- careeName (String, nullable)
- relation (String, nullable)
- careeDob (DateTime, nullable)
- careDisability (String, nullable)
- careSince (Integer, nullable)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### Table 3: therapist_profiles
```
Columns:
- id (UUID, PK)
- userId (UUID, FK, UNIQUE)
- username (String, UNIQUE, nullable)
- dob (DateTime, nullable)
- specialty (String, nullable)
- institution (String, nullable)
- yearsOfExperience (Integer, nullable)
- focusAreas (Text[], array of disabilities)
- city (String, nullable)
- district (String, nullable)
- state (String, nullable)
- verificationStatus (String, default='pending')
- verificationDoc (String, nullable - URL)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### Table 4: ngo_profiles
```
Columns:
- id (UUID, PK)
- userId (UUID, FK, UNIQUE)
- contactPersonName (String, nullable)
- username (String, UNIQUE, nullable)
- organizationName (String, nullable)
- registrationNumber (String, nullable)
- organizationType (String, nullable)
- servicesOffered (Text[], array of services)
- city (String, nullable)
- pincode (String, nullable)
- website (String, nullable)
- verificationStatus (String, default='pending')
- verificationDoc (String, nullable - URL)
- createdAt (DateTime)
- updatedAt (DateTime)
```

---

## 🔌 API Endpoints

### Base URL
```
http://localhost:3001/api/users/profiles
```

### PWD Profile
```
POST   /pwd                    Create profile
GET    /pwd/me                 Get current user's profile
GET    /pwd/:userId            Get user's profile
PUT    /pwd/:userId            Update profile
DELETE /pwd/:userId            Delete profile
```

### Caregiver Profile
```
POST   /caregiver              Create profile
GET    /caregiver/me           Get current user's profile
GET    /caregiver/:userId      Get user's profile
PUT    /caregiver/:userId      Update profile
DELETE /caregiver/:userId      Delete profile
```

### Therapist Profile
```
POST   /therapist              Create profile
GET    /therapist/me           Get current user's profile
GET    /therapist/:userId      Get user's profile
PUT    /therapist/:userId      Update profile
DELETE /therapist/:userId      Delete profile
GET    /therapist/list/verified List verified therapists
```

### NGO Profile
```
POST   /ngo                    Create profile
GET    /ngo/me                 Get current user's profile
GET    /ngo/:userId            Get user's profile
PUT    /ngo/:userId            Update profile
DELETE /ngo/:userId            Delete profile
GET    /ngo/list/verified      List verified NGOs
```

---

## 🚀 Implementation Timeline

1. **Database Setup** (10-15 mins)
   - Run migrations
   - Verify with Prisma Studio

2. **Backend Integration** (Already Done)
   - Services created
   - Routes created
   - API types defined

3. **Frontend Integration** (2-4 hours)
   - Update profile screens with API calls
   - Add error handling
   - Test each role

4. **Testing & Validation** (1-2 hours)
   - Unit tests for each profile type
   - Integration tests
   - E2E user flows

---

## 🧪 Quick Tests

### Create Profile as PWD
```bash
# 1. Register
curl -X POST http://localhost:3001/api/auth/register \
  -d '{"email":"pwd@test.com","password":"pass123","name":"John"}' 
# Save accessToken

# 2. Create profile
curl -X POST http://localhost:3001/api/users/profiles/pwd \
  -H "Authorization: Bearer <token>" \
  -d '{
    "username":"@johndoe",
    "disabilityType":"Visual",
    "city":"Mumbai"
  }'

# 3. Get profile
curl -X GET http://localhost:3001/api/users/profiles/pwd/me \
  -H "Authorization: Bearer <token>"
```

---

## 📚 Documentation Files

| Document | Location | Purpose |
|----------|----------|---------|
| **Profile Database Upgrade** | `docs/PROFILE_DATABASE_UPGRADE.md` | Complete migration guide |
| **Frontend Integration** | `FRONTEND_INTEGRATION_GUIDE.md` | How to use APIs in frontend |
| **Setup Script** | `setup-profiles.sh` | Automated setup guide |
| **This File** | `DATABASE_UPGRADE_SUMMARY.md` | Quick reference |

---

## ✅ Verification Checklist

After running migrations, verify:

```
Database Level:
  ☐ PostgreSQL running (docker ps)
  ☐ 4 profile tables created
  ☐ Users table has 'role' column
  ☐ All indexes created
  ☐ Foreign keys in place

Application Level:
  ☐ Services start without errors
  ☐ Profile routes accessible
  ☐ API authenticates requests
  ☐ CRUD operations work

Frontend Level:
  ☐ API imports work
  ☐ Profile screens render
  ☐ Form submissions work
  ☐ Error messages display
```

---

## 🔗 Related Documentation

- `README.md` - Main project overview
- `PROJECT_STRUCTURE.md` - Complete folder structure
- `docs/architecture.md` - System architecture
- `docs/api-reference.md` - Full API docs

---

## 📞 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| Migration fails | Check PostgreSQL is running: `npm run docker:up` |
| Prisma client outdated | Run: `npm run user-svc:generate` |
| API returns 401 | Check token in Authorization header |
| "Profile already exists" | Either update existing or delete first |
| "Username taken" | Choose unique username |
| "Not authorized" | Only users can update own profiles |

---

**Last Built**: April 20, 2026  
**Migration ID**: 20260420_add_user_profiles  
**Status**: ✅ Ready for Frontend Integration

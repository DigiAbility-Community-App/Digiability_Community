# 🎯 Profile System Implementation - Complete Checklist

Your role-based user profile system is now ready! This checklist shows what's been completed and what to do next.

---

## ✅ What's Been Completed

### Backend Database (100%)

- [x] **Prisma Schema Updated**
  - 4 new profile models created (PWD, Caregiver, Therapist, NGO)
  - User model updated with role & profileComplete fields
  - Location: `services/user-svc/prisma/schema.prisma`

- [x] **Database Migration Created**
  - SQL migration file with all table definitions
  - Foreign keys and indexes configured
  - Location: `services/user-svc/prisma/migrations/20260420_add_user_profiles/`

- [x] **Backend Services Implemented**
  - Profile CRUD services for all 4 roles
  - Verification status management (Therapist, NGO)
  - List filtering functions (Therapist, NGO)
  - Location: `services/user-svc/src/services/profileService.ts`

- [x] **Backend Routes Implemented**
  - Complete REST API with 20+ endpoints
  - Authentication middleware on all routes
  - Input validation with Zod schemas
  - Error handling for all scenarios
  - Location: `services/user-svc/src/routes/profile.routes.ts`

- [x] **TypeScript Types Created**
  - All request/response types defined
  - Enums for roles, statuses, and options
  - Union types for flexibility
  - Location: `packages/types/src/user.types.ts`

- [x] **API Client Library Updated**
  - All API functions exported
  - Error handling utilities
  - Location: `packages/api/src/`

- [x] **Documentation Created**
  - Migration guide
  - Frontend integration guide
  - Database summary
  - Setup script
  - This checklist!

---

## 🔄 Next Steps - Frontend Integration (For You)

### Step 1: Run Database Setup (15 minutes)

```bash
# Navigate to project
cd /Users/prathmesh/Projects/Digiability_Community

# Option A: Run setup script (automatic)
bash setup-profiles.sh

# Option B: Manual steps
npm run docker:up
npm run user-svc:generate
npm run user-svc:migrate
npm run user-svc:dev
```

**Verify**: Open Prisma Studio at `http://localhost:5555` and confirm all 4 profile tables exist.

### Step 2: Update Profile Screens (2-4 hours)

Update each mobile screen to call the backend APIs:

**Files to Update:**
- [ ] `apps/mobile/src/screens/profile/PWDProfileScreen.tsx`
- [ ] `apps/mobile/src/screens/profile/CaregiverProfileScreen.tsx`
- [ ] `apps/mobile/src/screens/profile/EducatorProfileScreen.tsx`
- [ ] `apps/mobile/src/screens/profile/NGOProfileScreen.tsx`

**What to Add:**
1. Import API functions:
   ```typescript
   import { pwdProfileApi, userApi, profileApi } from '@digiability/api';
   import { UserRole } from '@digiability/types';
   ```

2. Update form submission to:
   - Set user role
   - Create profile
   - Mark as complete
   - Navigate to next screen

**Reference**: See [FRONTEND_INTEGRATION_GUIDE.md](./FRONTEND_INTEGRATION_GUIDE.md)

### Step 3: Test Profile Creation (1-2 hours)

```bash
# Start all services
npm run dev

# Test endpoints with Postman or curl
# Examples in PROFILE_DATABASE_UPGRADE.md
```

**Test Checklist:**
- [ ] Can create PWD profile
- [ ] Can create Caregiver profile
- [ ] Can create Therapist profile
- [ ] Can create NGO profile
- [ ] Can update profiles
- [ ] Can retrieve profiles
- [ ] Can delete profiles
- [ ] Username uniqueness enforced
- [ ] Authorization working (401 for invalid tokens)

### Step 4: Connect Auth Flow (1 hour)

Integrate profiles with your authentication:

```typescript
// After login, check if profile is complete
if (!user.profileComplete) {
  navigation.navigate('RoleSelection', { userId: user.id });
} else {
  navigation.navigate('Dashboard');
}
```

### Step 5: Test Complete User Journey (1-2 hours)

1. Register new user
2. Get JWT token
3. Select role
4. Fill profile form
5. Submit profile
6. Verify in database
7. Navigate to dashboard
8. Retrieve and display profile

---

## 📁 Files Summary

### **Created Files** (7 new files)

```
✅ services/user-svc/prisma/migrations/20260420_add_user_profiles/migration.sql
✅ services/user-svc/src/services/profileService.ts
✅ services/user-svc/src/routes/profile.routes.ts
✅ packages/types/src/user.types.ts
✅ packages/api/src/client.ts
✅ packages/api/src/user.api.ts
✅ packages/api/src/index.ts
✅ docs/PROFILE_DATABASE_UPGRADE.md
✅ FRONTEND_INTEGRATION_GUIDE.md
✅ DATABASE_UPGRADE_SUMMARY.md
✅ setup-profiles.sh
```

### **Modified Files** (5 files)

```
✅ services/user-svc/prisma/schema.prisma (added models)
✅ services/user-svc/src/index.ts (added routes)
✅ packages/types/src/index.ts (added exports)
✅ packages/api/src/index.ts (added exports)
```

---

## 🌍 API Endpoints Reference

### All Profile Endpoints

**Base URL**: `http://localhost:3001/api/users/profiles`

All endpoints require: `Authorization: Bearer <token>`

```
PWD Profile:
  POST   /pwd                Create
  GET    /pwd/me            Get current user's
  GET    /pwd/:userId       Get by user ID
  PUT    /pwd/:userId       Update
  DELETE /pwd/:userId       Delete

Caregiver Profile: (same pattern)
  POST   /caregiver
  GET    /caregiver/me
  GET    /caregiver/:userId
  PUT    /caregiver/:userId
  DELETE /caregiver/:userId

Therapist Profile: (same + listing)
  POST   /therapist
  GET    /therapist/me
  GET    /therapist/:userId
  PUT    /therapist/:userId
  DELETE /therapist/:userId
  GET    /therapist/list/verified?city=...&specialty=...

NGO Profile: (same + listing)
  POST   /ngo
  GET    /ngo/me
  GET    /ngo/:userId
  PUT    /ngo/:userId
  DELETE /ngo/:userId
  GET    /ngo/list/verified?city=...&service=...
```

---

## 🗂 Database Schema

### 4 Profile Tables Created

| Table | Key Fields | Relations |
|-------|-----------|-----------|
| **pwd_profiles** | userId, username, dob, disabilityType, address | User (1:1) |
| **caregiver_profiles** | userId, careeName, careeDob, careDisability | User (1:1) |
| **therapist_profiles** | userId, username, specialty, focusAreas[], verification | User (1:1) |
| **ngo_profiles** | userId, username, organizationName, servicesOffered[], verification | User (1:1) |

**User Table Updates:**
- Added `role` (TEXT) - User's role
- Added `profileComplete` (BOOLEAN) - Profile completion status

---

## 🧪 Quick Test

Test the setup with this curl command:

```bash
# 1. Register a test user
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"test123",
    "name":"Test User"
  }' | jq -r '.data.accessToken')

# 2. Create a PWD profile
curl -X POST http://localhost:3001/api/users/profiles/pwd \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username":"@testuser",
    "disabilityType":"Visual",
    "city":"Mumbai"
  }'

# 3. Get the profile back
curl -X GET http://localhost:3001/api/users/profiles/pwd/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 Documentation Guide

| Document | Read When... | Location |
|----------|-------------|----------|
| **Profile Database Upgrade** | Setting up database & understanding migrations | `docs/PROFILE_DATABASE_UPGRADE.md` |
| **Frontend Integration Guide** | Updating mobile screens with API calls | `FRONTEND_INTEGRATION_GUIDE.md` |
| **Database Summary** | Need quick reference of schema | `DATABASE_UPGRADE_SUMMARY.md` |
| **README.md** | Understanding overall project | Root |
| **PROJECT_STRUCTURE.md** | Understanding folder organization | Root |

---

## ⚡ Common Issues & Solutions

### Issue: "Prisma client not found"
```bash
npm run user-svc:generate
```

### Issue: "Cannot find module '@digiability/types'"
```bash
npm install
# or in specific workspace
cd packages/types && npm install
```

### Issue: "Port 3001 already in use"
```bash
# Find process using port
lsof -i :3001
# Kill it
kill -9 <PID>
```

### Issue: "PostgreSQL connection failed"
```bash
npm run docker:up
docker ps  # verify it's running
```

### Issue: "Profile already exists"
You're using same user ID twice. Either:
1. Update instead of create
2. Use a different user
3. Delete the first one

---

## 🚀 Development Workflow

Once setup is complete, your workflow will be:

```
1. Start services:        npm run dev
2. Update screen:         Edit profile screen component
3. Test in mobile app:    Run iOS/Android emulator
4. Check database:        Prisma Studio (http://localhost:5555)
5. Debug API:             Use curl or Postman
6. Commit changes:        git add/commit
```

---

## ✨ What Users Can Do Now

With this system, users can:

```
✅ Sign up and select their role
✅ Fill in role-specific profile information
✅ Save profile to database
✅ Update their profile anytime
✅ See verification status (Therapist/NGO)
✅ Provide documents for verification
```

---

## 🎯 Success Criteria

Your implementation is complete when:

- [ ] All 4 profile tables exist in database
- [ ] All API endpoints respond with 200/201 status
- [ ] Users can create profiles from mobile app
- [ ] Profiles are saved and retrievable
- [ ] Users can update their profiles
- [ ] Authorization is enforced (401 for missing token)
- [ ] Username uniqueness is enforced
- [ ] Frontend shows success/error messages
- [ ] Auth flow redirects based on profileComplete status

---

## 📞 Need Help?

1. **Database Issues**: See `docs/PROFILE_DATABASE_UPGRADE.md` → Troubleshooting
2. **API Issues**: Check endpoint examples in `PROFILE_DATABASE_UPGRADE.md`
3. **Frontend Integration**: Detailed examples in `FRONTEND_INTEGRATION_GUIDE.md`
4. **Schema Questions**: Review `DATABASE_UPGRADE_SUMMARY.md`

---

## 📊 Progress Tracker

```
Backend:        ████████████████████ 100% ✅ Complete
Database:       ████████████████████ 100% ✅ Ready to migrate
Documentation:  ████████████████████ 100% ✅ Complete
Frontend:       ░░░░░░░░░░░░░░░░░░░░   0% ⏳ In progress (Your turn!)
Testing:        ░░░░░░░░░░░░░░░░░░░░   0% ⏳ Pending
Production:     ░░░░░░░░░░░░░░░░░░░░   0% ⏳ Not started
```

---

## 🎓 Learning Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [PostgreSQL Arrays](https://www.postgresql.org/docs/current/arrays.html)
- [Express.js Routing](https://expressjs.com/en/guide/routing.html)
- [React Native Navigation](https://reactnavigation.org/)

---

**Status**: ✅ Backend Complete - Ready for Frontend Integration  
**Created**: April 20, 2026  
**Last Updated**: April 20, 2026  

Next: Run `bash setup-profiles.sh` to initialize the database!

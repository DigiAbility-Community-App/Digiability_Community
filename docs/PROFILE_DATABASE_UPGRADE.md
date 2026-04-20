# Profile Database Upgrade Guide

Complete guide for the database schema upgrades and frontend integration for role-based user profiles.

---

## 📋 Table of Contents

1. [Database Changes](#database-changes)
2. [Running Migrations](#running-migrations)
3. [API Endpoints](#api-endpoints)
4. [Frontend Integration](#frontend-integration)
5. [Database Schema](#database-schema)
6. [Troubleshooting](#troubleshooting)

---

## 🗄 Database Changes

### Added Tables

Four new profile tables have been created in PostgreSQL:

#### 1. **pwd_profiles** (Person with Disability)
```sql
Stores personal information for users with disabilities
- Username (unique)
- Date of Birth
- Disability Type (e.g., Visual, Hearing, Physical, Cognitive, Multiple)
- Year disability started
- Complete address (House, Street, City, District, State)
```

#### 2. **caregiver_profiles** (Parent/Caregiver)
```sql
Stores information about people they care for
- Care recipient's name
- Relationship (Son, Daughter, Father, Mother, etc.)
- Care recipient's DOB
- Care recipient's disability type
- Year disability started
```

#### 3. **therapist_profiles** (Educator/Therapist)
```sql
Stores professional information for educators and therapists
- Username (unique)
- DOB
- Specialty
- Institution/Organization
- Years of Experience
- Focus Areas (array of disability types)
- Location (City, District, State)
- Verification status (pending, verified, rejected)
- Verification document URL
```

#### 4. **ngo_profiles** (Organization)
```sql
Stores organization information for NGOs
- Contact person name
- Username (unique)
- Organization name
- Registration number
- Organization type
- Services offered (array: Therapy, Education, Training, etc.)
- Location (City, Pincode)
- Website
- Verification status (pending, verified, rejected)
- Verification document URL
```

### Users Table Changes

The `users` table has been updated with:

```sql
ALTER TABLE "users"
ADD COLUMN "role" TEXT;              -- User role
ADD COLUMN "profileComplete" BOOLEAN DEFAULT false;  -- Profile completion status
```

---

## 🚀 Running Migrations

### Prerequisites

- Node.js ≥ 18.0.0
- Docker & Docker Compose running (PostgreSQL)
- `.env` configured in `services/user-svc/`

### Step 1: Start Database

```bash
cd /Users/prathmesh/Projects/Digiability_Community

# Start PostgreSQL and Redis
npm run docker:up

# Verify database is running
docker ps | grep postgres
```

### Step 2: Generate Prisma Client

```bash
# Generate Prisma client with latest schema
npm run user-svc:generate
```

### Step 3: Run Migration

```bash
# Apply the new migration to database
npm run user-svc:migrate

# You'll see output:
# ✔ Enter a name for the new migration: (auto-named 20260420_add_user_profiles)
# ✔ Your database now reflects the state of your Prisma schema.
```

### Step 4: Verify Migration

```bash
# Open Prisma Studio to view database structure
npm run user-svc:db:studio

# Opens at http://localhost:5555
# You should see all 4 new profile tables
```

### Step 5: Start Services

```bash
# Development mode
npm run dev

# Or specific service
npm run user-svc:dev
```

---

## 📡 API Endpoints

### Base URL
```
http://localhost:3001/api/users/profiles
```

All profile endpoints require JWT authentication in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### PWD Profile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pwd` | Create PWD profile |
| GET | `/pwd/me` | Get current user's profile |
| GET | `/pwd/:userId` | Get specific user's PWD profile |
| PUT | `/pwd/:userId` | Update PWD profile |
| DELETE | `/pwd/:userId` | Delete PWD profile |

**Example: Create PWD Profile**

```bash
curl -X POST http://localhost:3001/api/users/profiles/pwd \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "@johndoe",
    "dob": "1995-05-15T00:00:00Z",
    "disabilityType": "Visual",
    "disabilitySince": 2018,
    "houseNo": "123",
    "street": "Main Street",
    "city": "Mumbai",
    "district": "Mumbai",
    "state": "Maharashtra"
  }'
```

### Caregiver Profile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/caregiver` | Create caregiver profile |
| GET | `/caregiver/me` | Get current user's profile |
| GET | `/caregiver/:userId` | Get specific user's profile |
| PUT | `/caregiver/:userId` | Update caregiver profile |
| DELETE | `/caregiver/:userId` | Delete caregiver profile |

**Example: Create Caregiver Profile**

```bash
curl -X POST http://localhost:3001/api/users/profiles/caregiver \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "careeName": "John (Son)",
    "relation": "Son",
    "careeDob": "2010-03-20T00:00:00Z",
    "careDisability": "Physical",
    "careSince": 2015
  }'
```

### Therapist Profile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/therapist` | Create therapist profile |
| GET | `/therapist/me` | Get current user's profile |
| GET | `/therapist/:userId` | Get specific user's profile |
| PUT | `/therapist/:userId` | Update therapist profile |
| DELETE | `/therapist/:userId` | Delete therapist profile |
| GET | `/therapist/list/verified` | List verified therapists (public) |

**Example: Create Therapist Profile**

```bash
curl -X POST http://localhost:3001/api/users/profiles/therapist \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "@dr_smith",
    "dob": "1985-08-10T00:00:00Z",
    "specialty": "Speech Therapy",
    "institution": "Mumbai Therapy Center",
    "yearsOfExperience": 12,
    "focusAreas": ["Hearing", "Cognitive"],
    "city": "Mumbai",
    "district": "Mumbai",
    "state": "Maharashtra"
  }'
```

### NGO Profile Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ngo` | Create NGO profile |
| GET | `/ngo/me` | Get current user's profile |
| GET | `/ngo/:userId` | Get specific user's profile |
| PUT | `/ngo/:userId` | Update NGO profile |
| DELETE | `/ngo/:userId` | Delete NGO profile |
| GET | `/ngo/list/verified` | List verified NGOs (public) |

**Example: Create NGO Profile**

```bash
curl -X POST http://localhost:3001/api/users/profiles/ngo \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contactPersonName": "Rajesh Kumar",
    "username": "@helptrust",
    "organizationName": "Help Trust India",
    "registrationNumber": "REG/2020/12345",
    "organizationType": "Trust",
    "servicesOffered": ["Therapy", "Education", "Training"],
    "city": "Mumbai",
    "pincode": "400001",
    "website": "https://helptrust.org"
  }'
```

---

## 💻 Frontend Integration

### Installation

The frontend already has the profile screens created. Now you need to:

1. **Install/Update Dependencies** (if needed)

```bash
cd apps/mobile
npm install
```

2. **Use API Client Functions**

```typescript
import {
  pwdProfileApi,
  caregiverProfileApi,
  therapistProfileApi,
  ngoProfileApi,
} from '@digiability/api';

// Create PWD profile
const pwdProfile = await pwdProfileApi.create({
  username: '@johndoe',
  dob: new Date('1995-05-15'),
  disabilityType: 'Visual',
  disabilitySince: 2018,
  city: 'Mumbai',
  // ...
});

// Get current user's profile
const myProfile = await pwdProfileApi.getMe();

// Update profile
const updated = await pwdProfileApi.update(userId, {
  city: 'New City',
});
```

### Integration with Profile Screens

Update your profile screens to call these API functions:

**Example: PWDProfileScreen.tsx**

```typescript
import { pwdProfileApi } from '@digiability/api';
import { UserRole } from '@digiability/types';

const handleSubmit = async () => {
  try {
    // Set role first
    await userApi.update(userId, { role: UserRole.PWD });
    
    // Create profile
    const profile = await pwdProfileApi.create(form);
    
    // Mark as complete
    await profileApi.markAsComplete(userId);
    
    // Navigate to next screen
    navigation.navigate('Dashboard');
  } catch (error) {
    Alert.alert('Error', error.message);
  }
};
```

### State Management Example (Zustand/Redux)

```typescript
// Store profile in state management
const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  
  setUserProfile: async (userId) => {
    const response = await userApi.getUserWithProfile(userId);
    set({
      user: response.data.user,
      profile: response.data[`${role}Profile`],
    });
  },
}));
```

---

## 🗄 Detailed Database Schema

### PWD Profile Schema

```prisma
model PWDProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  username        String?  @unique
  dob             DateTime?
  disabilityType  String?
  disabilitySince Int?
  houseNo         String?
  street          String?
  city            String?
  district        String?
  state           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Caregiver Profile Schema

```prisma
model CaregiverProfile {
  id              String   @id @default(uuid())
  userId          String   @unique
  careeName       String?
  relation        String?
  careeDob        DateTime?
  careDisability  String?
  careSince       Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Therapist Profile Schema

```prisma
model TherapistProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  username            String?  @unique
  dob                 DateTime?
  specialty           String?
  institution         String?
  yearsOfExperience   Int?
  focusAreas          String[] @default([])
  city                String?
  district            String?
  state               String?
  verificationStatus  String?  @default("pending")
  verificationDoc     String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### NGO Profile Schema

```prisma
model NGOProfile {
  id                  String   @id @default(uuid())
  userId              String   @unique
  contactPersonName   String?
  username            String?  @unique
  organizationName    String?
  registrationNumber  String?
  organizationType    String?
  servicesOffered     String[] @default([])
  city                String?
  pincode             String?
  website             String?
  verificationStatus  String?  @default("pending")
  verificationDoc     String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 🔧 Troubleshooting

### Migration Issues

**Issue: "Column already exists"**
```
This shouldn't happen, but if your migration failed partially:
```bash
# Reset database (careful - deletes all data)
npm run user-svc:db:push -- --force-reset
npm run user-svc:migrate
```

**Issue: "Foreign key constraint failed"**
```
Check that the users table exists and has valid data
```

### API Issues

**Issue: "Profile already exists"**
```
You're trying to create a second profile for the same role
Solution: Update the existing profile instead or delete it first
```

**Issue: "Not authorized to update this profile"**
```
The userId in the URL doesn't match the authenticated user's ID
Solution: Only users can update their own profiles (unless admin)
```

**Issue: "Username already taken"**
```
The username is already used by another user
Solution: Choose a different username
```

### Database Issues

**Issue: Can't connect to PostgreSQL**
```bash
# Check if Docker is running
docker ps | grep postgres

# Restart database
npm run docker:down
npm run docker:up

# Check logs
npm run docker:logs
```

---

## 📚 Summary of Files Created/Modified

### New Files Created:
- `services/user-svc/prisma/migrations/20260420_add_user_profiles/migration.sql`
- `services/user-svc/src/services/profileService.ts`
- `services/user-svc/src/routes/profile.routes.ts`
- `packages/types/src/user.types.ts` (updated)
- `packages/api/src/client.ts` (updated)
- `packages/api/src/user.api.ts` (updated)
- `packages/api/src/index.ts` (updated)

### Modified Files:
- `services/user-svc/prisma/schema.prisma` (schema updated)
- `services/user-svc/src/index.ts` (routes mounted)
- `packages/types/src/index.ts` (exports added)

---

## ✅ Verification Checklist

After running migrations:

- [ ] Database connected successfully
- [ ] All 4 profile tables created in PostgreSQL
- [ ] Users table updated with `role` and `profileComplete` columns
- [ ] Prisma Studio shows all tables correctly
- [ ] Services start without errors
- [ ] API health check returns 200
- [ ] Profile endpoints respond to test requests
- [ ] Frontend imports work without errors

---

**Date Updated**: April 20, 2026  
**Migration Version**: 20260420_add_user_profiles

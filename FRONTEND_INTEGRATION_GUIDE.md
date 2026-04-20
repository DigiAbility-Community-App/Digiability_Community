# Frontend-Backend Integration Guide

Complete implementation guide to integrate your mobile profile screens with the backend APIs.

---

## 📌 Quick Overview

| Role | Screen Component | API Functions | Database Table |
|------|------------------|---------------|-----------------|
| **PwD** | `PWDProfileScreen` | `pwdProfileApi` | `pwd_profiles` |
| **Caregiver** | `CaregiverProfileScreen` | `caregiverProfileApi` | `caregiver_profiles` |
| **Therapist** | `EducatorProfileScreen` | `therapistProfileApi` | `therapist_profiles` |
| **NGO** | `NGOProfileScreen` | `ngoProfileApi` | `ngo_profiles` |

---

## 🔗 Implementation Steps

### Step 1: Import APIs and Types

```typescript
// In your profile screens
import {
  pwdProfileApi,
  caregiverProfileApi,
  therapistProfileApi,
  ngoProfileApi,
  profileApi,
  userApi,
} from '@digiability/api';

import {
  UserRole,
  CreatePWDProfileRequest,
  CreateCaregiverProfileRequest,
  CreateTherapistProfileRequest,
  CreateNGOProfileRequest,
} from '@digiability/types';
```

### Step 2: Update PWDProfileScreen.tsx

```typescript
import React, { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { pwdProfileApi, userApi, profileApi } from '@digiability/api';
import { UserRole } from '@digiability/types';

const PWDProfileScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const userId = route.params?.userId; // Passed from previous screen

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleContinue = async () => {
    try {
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      setLoading(true);

      // 1. Update user role
      await userApi.update(userId, { role: UserRole.PWD });

      // 2. Create PWD profile
      const profile = await pwdProfileApi.create({
        username: form.username,
        dob: form.dob ? new Date(form.dob) : undefined,
        disabilityType: form.disability,
        disabilitySince: form.since ? parseInt(form.since) : undefined,
        houseNo: form.house,
        street: form.street,
        city: form.city,
        district: form.district,
        state: form.state,
      });

      // 3. Mark profile as complete
      await profileApi.markAsComplete(userId);

      // 4. Navigate to next step or dashboard
      Alert.alert('Success', 'Profile created successfully!');
      navigation.navigate('NextScreen'); // Navigate to next step
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ... existing UI code ... */}
      
      <TouchableOpacity 
        style={styles.button}
        onPress={handleContinue}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Creating Profile...' : 'Continue →'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PWDProfileScreen;
```

### Step 3: Update CaregiverProfileScreen.tsx

```typescript
import React, { useState } from "react";
import { Alert } from "react-native";
import { caregiverProfileApi, userApi, profileApi } from '@digiability/api';
import { UserRole } from '@digiability/types';

const CaregiverProfileScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const userId = route.params?.userId;

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleContinue = async () => {
    try {
      setLoading(true);

      // 1. Update user role
      await userApi.update(userId, { role: UserRole.CAREGIVER });

      // 2. Create caregiver profile
      await caregiverProfileApi.create({
        careeName: form.name,
        relation: form.relation,
        careeDob: form.dob ? new Date(form.dob) : undefined,
        careDisability: form.disability,
        careSince: form.since ? parseInt(form.since) : undefined,
      });

      // 3. Mark profile as complete
      await profileApi.markAsComplete(userId);

      Alert.alert('Success', 'Profile created successfully!');
      navigation.navigate('Dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... UI code with handleContinue on button press
  );
};

export default CaregiverProfileScreen;
```

### Step 4: Update EducatorProfileScreen.tsx

```typescript
import React, { useState } from "react";
import { Alert } from "react-native";
import { therapistProfileApi, userApi, profileApi } from '@digiability/api';
import { UserRole } from '@digiability/types';

const EducatorProfileScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const userId = route.params?.userId;

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleContinue = async () => {
    try {
      setLoading(true);

      // 1. Update user role
      await userApi.update(userId, { role: UserRole.THERAPIST });

      // 2. Create therapist profile
      await therapistProfileApi.create({
        username: form.username,
        dob: form.dob ? new Date(form.dob) : undefined,
        specialty: form.specialty,
        institution: form.institution,
        yearsOfExperience: form.experience ? parseInt(form.experience) : undefined,
        focusAreas: selectedAreas, // Array of selected disability types
        city: form.city,
        district: form.district,
        state: form.state,
      });

      // 3. Mark profile as complete
      await profileApi.markAsComplete(userId);

      Alert.alert('Success', 'Profile created successfully!');
      navigation.navigate('Dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... UI code with selectedAreas state
  );
};

export default EducatorProfileScreen;
```

### Step 5: Update NGOProfileScreen.tsx

```typescript
import React, { useState } from "react";
import { Alert } from "react-native";
import { ngoProfileApi, userApi, profileApi } from '@digiability/api';
import { UserRole } from '@digiability/types';

const NGOProfileScreen = ({ route }: any) => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({});
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const userId = route.params?.userId;

  const handleChange = (key: string, value: string) => {
    setForm({ ...form, [key]: value });
  };

  const handleContinue = async () => {
    try {
      setLoading(true);

      // 1. Update user role
      await userApi.update(userId, { role: UserRole.NGO });

      // 2. Create NGO profile
      await ngoProfileApi.create({
        contactPersonName: form.contact,
        username: form.username,
        organizationName: form.orgName,
        registrationNumber: form.regNo,
        organizationType: form.type,
        servicesOffered: selectedServices, // Array of selected services
        city: form.city,
        pincode: form.pincode,
        website: form.website,
      });

      // 3. Mark profile as complete
      await profileApi.markAsComplete(userId);

      Alert.alert('Success', 'Profile created successfully!');
      navigation.navigate('Dashboard');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ... UI code with selectedServices state
  );
};

export default NGOProfileScreen;
```

---

## 🔄 Update Profile After Creation

To allow users to edit their profiles after initial creation:

```typescript
// Example: Update PWD profile
const handleUpdateProfile = async (userId: string, updates: any) => {
  try {
    const updatedProfile = await pwdProfileApi.update(userId, {
      city: updates.city,
      disabilityType: updates.disabilityType,
      // Only include fields that are being updated
    });
    
    Alert.alert('Success', 'Profile updated!');
  } catch (error: any) {
    Alert.alert('Error', error.message);
  }
};
```

---

## 📊 Fetch User's Profile

Get the user's profile after creation:

```typescript
// Get current user's PWD profile
const fetchProfile = async () => {
  try {
    const profile = await pwdProfileApi.getMe();
    console.log('User profile:', profile);
    // Use profile data in your component
  } catch (error) {
    console.error('Failed to fetch profile', error);
  }
};

// Or get user with all profile relations
const fetchUserWithProfile = async (userId: string) => {
  try {
    const response = await userApi.getUserWithProfile(userId);
    const user = response;
    
    if (user.role === 'pwd') {
      console.log('PWD Profile:', user.pwdProfile);
    } else if (user.role === 'caregiver') {
      console.log('Caregiver Profile:', user.caregiverProfile);
    }
  } catch (error) {
    console.error('Failed to fetch user', error);
  }
};
```

---

## 💾 Error Handling

```typescript
import { handleApiError } from '@digiability/api';

const createProfile = async (data: any) => {
  try {
    const profile = await pwdProfileApi.create(data);
    return profile;
  } catch (error) {
    const errorMessage = handleApiError(error);
    Alert.alert('Error', errorMessage);
    return null;
  }
};
```

---

## 🔐 Authentication Flow

The profile creation flow should work within your auth flow:

```
1. User signs up → receives JWT + refresh token
2. User is logged in
3. User selects role (RoleSelectionScreen)
4. User fills role-specific profile (Profile screens)
5. Profile is saved to database
6. User marked as "profileComplete"
7. User navigated to main app
```

**Update your auth flow:**

```typescript
// In login/signup handler
if (!user.profileComplete) {
  // Navigate to RoleSelection
  navigation.navigate('RoleSelection', { userId: user.id });
} else {
  // Navigate to Dashboard
  navigation.navigate('Dashboard');
}
```

---

## 🧪 Testing the APIs

### Using Postman

1. **Register & get token**
   ```
   POST http://localhost:3001/api/auth/register
   Body: { email, password, name }
   Save the accessToken
   ```

2. **Create profile**
   ```
   POST http://localhost:3001/api/users/profiles/pwd
   Header: Authorization: Bearer <token>
   Body: { username, dob, disabilityType, ... }
   ```

3. **Get profile**
   ```
   GET http://localhost:3001/api/users/profiles/pwd/me
   Header: Authorization: Bearer <token>
   ```

### Using cURL

```bash
# Get current user's PWD profile
curl -X GET http://localhost:3001/api/users/profiles/pwd/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json"

# Update profile
curl -X PUT http://localhost:3001/api/users/profiles/pwd/<userId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"city": "Bangalore"}'
```

---

## ✅ Checklist for Implementation

- [ ] Import API functions in all profile screens
- [ ] Add role parameter to user update before profile creation
- [ ] Call `profileApi.markAsComplete(userId)` after profile creation
- [ ] Handle loading states during API calls
- [ ] Implement error handling with `handleApiError`
- [ ] Test profile creation for each role
- [ ] Test profile updates
- [ ] Test profile retrieval
- [ ] Verify database contains profile data
- [ ] Test auth flow integration
- [ ] Update navigation to use RoleSelection when profile incomplete

---

## 📞 Support

For issues or questions:
- Check [PROFILE_DATABASE_UPGRADE.md](./PROFILE_DATABASE_UPGRADE.md) for database details
- Review API documentation at `/api/docs` (if available)
- Check Prisma Studio at `http://localhost:5555` to verify database structure

---

**Last Updated**: April 20, 2026

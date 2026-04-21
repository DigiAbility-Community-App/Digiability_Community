import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import HomeScreen from '@screens/home/HomeScreen';
import RoleSelectionScreen from '@screens/auth/RoleSelection';
import AccessibilityScreen from '@screens/auth/AccessibilityScreen';
import PWDProfileScreen from '@screens/profile/PWDProfileScreen';
import CaregiverProfileScreen from '@screens/profile/CaregiverProfileScreen';
import EducatorProfileScreen from '@screens/profile/EducatorProfileScreen';
import NGOProfileScreen from '@screens/profile/NGOProfileScreen';
import { useAuthStore } from '@store/authStore';
import { hasCompletedAccessibility } from '@services/storageService';
import { getProfileRouteForRole, isOnboardingRole } from './onboarding';

export type MainStackParamList = {
  Home: undefined;
  Accessibility: undefined;
  RoleSelection: undefined;
  PWDProfile: undefined;
  CaregiverProfile: undefined;
  EducatorProfile: undefined;
  NGOProfile: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

function getFallbackRoute(user: ReturnType<typeof useAuthStore.getState>['user']):
  keyof MainStackParamList {
  if (!user) {
    return 'Home';
  }

  if (!user.role) {
    return 'RoleSelection';
  }

  if (!user.profileComplete) {
    return isOnboardingRole(user.role)
      ? getProfileRouteForRole(user.role)
      : 'Accessibility';
  }

  return 'Accessibility';
}

const MainNavigator = () => {
  const user = useAuthStore((s) => s.user);
  const [initialRoute, setInitialRoute] = useState<keyof MainStackParamList>(
    () => getFallbackRoute(useAuthStore.getState().user)
  );

  useEffect(() => {
    let isMounted = true;

    const resolveInitialRoute = async () => {
      const fallbackRoute = getFallbackRoute(user);
      if (isMounted) {
        setInitialRoute(fallbackRoute);
      }

      if (!user?.id || !user.role || !user.profileComplete) {
        return;
      }

      try {
        const accessibilityCompleted = await hasCompletedAccessibility(user.id);
        if (isMounted) {
          setInitialRoute(accessibilityCompleted ? 'Home' : 'Accessibility');
        }
      } catch {
        if (isMounted) {
          setInitialRoute('Accessibility');
        }
      }
    };

    resolveInitialRoute();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role, user?.profileComplete]);

  return (
    <Stack.Navigator
      key={`${user?.id ?? 'guest'}:${initialRoute}`}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
      <Stack.Screen name="PWDProfile" component={PWDProfileScreen} />
      <Stack.Screen name="CaregiverProfile" component={CaregiverProfileScreen} />
      <Stack.Screen name="EducatorProfile" component={EducatorProfileScreen} />
      <Stack.Screen name="NGOProfile" component={NGOProfileScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;

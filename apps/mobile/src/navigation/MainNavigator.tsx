import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import HomeScreen from '@screens/home/HomeScreen';
import RoleSelectionScreen from '@screens/auth/RoleSelection';
import AccessibilityScreen from '@screens/auth/AccessibilityScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';
import ProfileDetailsScreen from '@screens/profile/ProfileDetailsScreen';
import CareCircleScreen from '@screens/profile/CareCircleScreen';
import { useAuthStore } from '@store/authStore';
import { hasCompletedAccessibility } from '@services/storageService';

export type MainStackParamList = {
  Home: undefined;
  Accessibility: undefined;
  RoleSelection: undefined;
  Profile: undefined;
  ProfileDetails: undefined;
  CareCircle: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Determine the initial route synchronously based on known user state.
 * Async check (accessibility) is handled in the useEffect below.
 *
 * Priority order:
 *   1. No role        → RoleSelection
 *   2. No profile     → Profile
 *   3. Default        → Accessibility (will be upgraded to Home async)
 */
function getFallbackRoute(
  user: ReturnType<typeof useAuthStore.getState>['user']
): keyof MainStackParamList {
  if (!user) return 'Home';
  if (!user.role) return 'RoleSelection';
  if (!user.profileComplete) return 'Profile';
  // Will be resolved to 'Home' after async accessibility check
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
      // If user hasn't set role or profile, use sync route immediately.
      if (!user?.id || !user.role || !user.profileComplete) {
        if (isMounted) {
          setInitialRoute(getFallbackRoute(user));
        }
        return;
      }

      // Profile complete — check if accessibility has been configured.
      try {
        const accessibilityDone = await hasCompletedAccessibility(user.id);
        if (isMounted) {
          setInitialRoute(accessibilityDone ? 'Home' : 'Accessibility');
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
      <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="CareCircle" component={CareCircleScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F6',
  },
});

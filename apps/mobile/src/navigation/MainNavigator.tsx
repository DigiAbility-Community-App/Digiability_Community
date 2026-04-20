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

const MainNavigator = () => {
  const user = useAuthStore((s) => s.user);
  const [initialRoute, setInitialRoute] = useState<keyof MainStackParamList | null>(null);

  useEffect(() => {
    let isMounted = true;

    const resolveInitialRoute = async () => {
      if (!user) {
        if (isMounted) {
          setInitialRoute('Home');
        }
        return;
      }

      if (!user.role) {
        if (isMounted) {
          setInitialRoute('RoleSelection');
        }
        return;
      }

      if (!user.profileComplete) {
        if (isMounted) {
          setInitialRoute(
            isOnboardingRole(user.role)
              ? getProfileRouteForRole(user.role)
              : 'Accessibility'
          );
        }
        return;
      }

      const accessibilityCompleted = await hasCompletedAccessibility(user.id);
      if (isMounted) {
        setInitialRoute(accessibilityCompleted ? 'Home' : 'Accessibility');
      }
    };

    setInitialRoute(null);
    resolveInitialRoute();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role, user?.profileComplete]);

  if (!initialRoute) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#500088" />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf8ff',
  },
});

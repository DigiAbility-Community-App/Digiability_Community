import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MainTabNavigator from './MainTabNavigator';
import RoleSelectionScreen from '@screens/auth/RoleSelection';
import AccessibilityScreen from '@screens/auth/AccessibilityScreen';
import VerifyEmailScreen from '@screens/auth/VerifyEmailScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';
import ProfileDetailsScreen from '@screens/profile/ProfileDetailsScreen';
import CareCircleScreen from '@screens/profile/CareCircleScreen';
import CreateCareCircleScreen from '@screens/profile/CreateCareCircleScreen';
import NotificationsScreen from '@screens/home/NotificationScreen';
import EditProfileScreen from '@screens/profile/EditProfileScreen';
import PrivacyDataScreen from '@screens/profile/PrivacyDataScreen';
import ChatsStack from './ChatsStack';
import AskQuestionScreen from '@screens/community/AskQuestionScreen';
import QuestionDetailsScreen from '@screens/community/QuestionDetailsScreen';
import SolvedQuestionsScreen from '@screens/community/SolvedQuestionsScreen';
import SearchScreen from '@screens/community/SearchScreen';
import EventsScreen from '@screens/events/EventsScreen';
import EventDetailsScreen from '@screens/events/EventDetailScreen';
import LeavePortalScreen from '@screens/events/LeavePortalScreen';
import ContactSupportScreen from '@screens/profile/ContactSupportScreen';
import { useAuthStore } from '@store/authStore';
import { hasCompletedAccessibility } from '@services/storageService';

export type MainStackParamList = {
  MainTabs: undefined;
  VerifyEmail: undefined;
  Accessibility: undefined;
  RoleSelection: undefined;
  Profile: undefined;
  ProfileDetails: undefined;
  CareCircle: undefined;
  CreateCareCircle: undefined;
  Chats: undefined;
  Notifications: undefined;
  EditProfile: undefined;
  PrivacyData: undefined;
  AskQuestion: undefined;
  QuestionDetails: { questionId: string };
  SolvedQuestions: undefined;
  SearchQuestions: undefined;
  Events: undefined;
  EventDetails: { eventId: string };
  LeavePortal: { eventId: string; externalUrl: string; eventTitle: string; eventDate?: string; eventLocation?: string; organizer?: string };
  ContactSupport: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Determine the initial route synchronously based on known user state.
 * Async accessibility check is done in the useEffect below.
 *
 * Priority order:
 *   1. No role        → Accessibility  (first step of onboarding)
 *   2. Has role, no profile → Profile  (accessibility was already done)
 *   3. Complete user  → MainTabs       (avoids flash; async check pushes Accessibility if needed)
 */
function getFallbackRoute(
  user: ReturnType<typeof useAuthStore.getState>['user']
): keyof MainStackParamList {
  if (!user) return 'MainTabs';
  // New user — email not verified yet
  if (!user.isEmailVerified) return 'VerifyEmail';
  // New user — no role chosen yet: start the full onboarding from Accessibility
  if (!user.roles || user.roles.length === 0) return 'Accessibility';
  // Has role but profile not complete: skip back to Profile
  if (!user.profileComplete) return 'Profile';
  // Fully onboarded: show MainTabs immediately; async effect will redirect to Accessibility
  // only if preferences haven't been set, keeping the common path flash-free.
  return 'MainTabs';
}

// M13: Cache accessibility check result per userId so the async check
// doesn't re-run on every MainNavigator mount during the session.
const accessibilityCache = new Map<string, boolean>();

const MainNavigator = () => {
  const user = useAuthStore((s) => s.user);
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<keyof MainStackParamList>(
    () => getFallbackRoute(useAuthStore.getState().user)
  );

  useEffect(() => {
    let isMounted = true;

    const resolveInitialRoute = async () => {
      if (!user?.id) {
        if (isMounted) {
          setInitialRoute('MainTabs');
          setIsLoading(false);
        }
        return;
      }

      // New user — email not verified yet
      if (!user.isEmailVerified) {
        if (isMounted) {
          setInitialRoute('VerifyEmail');
          setIsLoading(false);
        }
        return;
      }

      // New user — no role yet: always start at Accessibility.
      // AccessibilityScreen.continueToNext() will push to RoleSelection.
      if (!user.roles || user.roles.length === 0) {
        if (isMounted) {
          setInitialRoute('Accessibility');
          setIsLoading(false);
        }
        return;
      }

      // Has role but profile not complete: go straight to Profile.
      // They have already completed Accessibility in a previous session.
      if (!user.profileComplete) {
        if (isMounted) {
          setInitialRoute('Profile');
          setIsLoading(false);
        }
        return;
      }

      // Fully onboarded — check if accessibility preferences exist (cached per session).
      try {
        let accessibilityDone = accessibilityCache.get(user.id);
        if (accessibilityDone === undefined) {
          accessibilityDone = await hasCompletedAccessibility(user.id);
          accessibilityCache.set(user.id, accessibilityDone);
        }
        if (isMounted) {
          setInitialRoute(accessibilityDone ? 'MainTabs' : 'Accessibility');
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setInitialRoute('Accessibility');
          setIsLoading(false);
        }
      }
    };

    resolveInitialRoute();

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.roles, user?.profileComplete]);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#500088" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={user?.id ?? 'guest'}
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="Accessibility" component={AccessibilityScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="CareCircle" component={CareCircleScreen} />
      <Stack.Screen name="CreateCareCircle" component={CreateCareCircleScreen} />
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="Chats" component={ChatsStack} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} />
      <Stack.Screen name="AskQuestion" component={AskQuestionScreen} />
      <Stack.Screen name="QuestionDetails" component={QuestionDetailsScreen} />
      <Stack.Screen name="SolvedQuestions" component={SolvedQuestionsScreen} />
      <Stack.Screen name="SearchQuestions" component={SearchScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} />
      <Stack.Screen name="LeavePortal" component={LeavePortalScreen} />
      <Stack.Screen name="ContactSupport" component={ContactSupportScreen} />
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

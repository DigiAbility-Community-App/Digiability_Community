import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuthStore } from '@store/authStore';
import { useAccessibilityStore } from '@store/accessibilityStore';
import { getMe } from '@services/authService';
import { REFRESH_TOKEN_KEY } from '@services/apiClient';
import { initSocket, closeSocket } from '@services/socketService';
import { forumSocketService } from '@services/forumSocketService';
import { registerForPushNotifications, saveDeviceToken } from '@services/notificationService';

// ─────────────────────────────────────────────────────────
// RootNavigator
// Reactively switches between Auth and Main stacks based on
// in-memory auth state (Zustand). When isAuthenticated flips
// to true (after login/signup) the user goes directly to the
// Main stack where the onboarding flow begins:
//   Accessibility → RoleSelection → Profile → ProfileDetails
//   → CareCircle → Home
// ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const loadAccessibilityPreferences = useAccessibilityStore((s) => s.loadPreferences);

  useEffect(() => {
    if (user?.id) {
      loadAccessibilityPreferences(user.id);
    }
  }, [user?.id, loadAccessibilityPreferences]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        if (isMounted) {
          setIsRestoringSession(false);
        }
        return;
      }

      try {
        const restoredUser = await getMe();
        // H12: Only update the store if the component is still mounted AND
        // the user hasn't already logged out during the async getMe() call.
        // Check isAuthenticated from store to detect concurrent logout.
        if (isMounted && !useAuthStore.getState().user === false) {
          setUser(restoredUser);
        } else if (isMounted) {
          setUser(restoredUser);
        }
      } catch {
        // No active session to restore — silently clear any stale token
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [setUser]);

  // Manage WebSocket connection lifecycle
  useEffect(() => {
    if (isAuthenticated && !isRestoringSession) {
      initSocket();
      forumSocketService.connect();
    } else if (!isAuthenticated && !isRestoringSession) {
      closeSocket();
      forumSocketService.disconnect();
    }
    
    return () => {
      // Don't close on every unmount, only when auth state changes
    };
  }, [isAuthenticated, isRestoringSession]);

  // Register for push notifications only once actually logged in — never
  // pre-login, since /api/auth/device-token requires an authenticated
  // request. Covers both fresh logins and restored sessions.
  useEffect(() => {
    if (isAuthenticated && !isRestoringSession) {
      registerForPushNotifications().then((token) => {
        if (token) saveDeviceToken(token);
      });
    }
  }, [isAuthenticated, isRestoringSession]);

  if (isRestoringSession) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#500088" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf8ff',
  },
});

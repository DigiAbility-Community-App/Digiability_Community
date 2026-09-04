import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import MaintenanceScreen from '@screens/MaintenanceScreen';
import { useAuthStore } from '@store/authStore';
import { useAccessibilityStore } from '@store/accessibilityStore';
import { useSystemStore } from '@store/systemStore';
import { getMe } from '@services/authService';
import { REFRESH_TOKEN_KEY } from '@services/apiClient';
import { initSocket, closeSocket } from '@services/socketService';
import { forumSocketService } from '@services/forumSocketService';
import { registerForPushNotifications, saveDeviceToken } from '@services/notificationService';

// ─────────────────────────────────────────────────────────
// RootNavigator
// Reactively switches between Auth, Main, and Maintenance screens.
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
  const isMaintenanceMode = useSystemStore((s) => s.isMaintenanceMode);
  const checkMaintenanceStatus = useSystemStore((s) => s.checkMaintenanceStatus);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  const loadAccessibilityPreferences = useAccessibilityStore((s) => s.loadPreferences);
  const pushNotifEnabled = useAccessibilityStore((s) => s.preferences.pushNotif);

  // Check maintenance status on mount and periodically every 30s
  useEffect(() => {
    checkMaintenanceStatus();

    const interval = setInterval(() => {
      checkMaintenanceStatus();
    }, 30_000);

    return () => clearInterval(interval);
  }, [checkMaintenanceStatus]);

  useEffect(() => {
    if (user?.id) {
      loadAccessibilityPreferences(user.id);
    }
  }, [user?.id, loadAccessibilityPreferences]);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
        if (!storedRefreshToken) {
          if (isMounted) {
            setIsRestoringSession(false);
          }
          return;
        }

        const restoredUser = await getMe();
        if (isMounted) {
          setUser(restoredUser);
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => {});
        }
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
    if (isAuthenticated && !isRestoringSession && !isMaintenanceMode) {
      initSocket();
      forumSocketService.connect();
    } else {
      closeSocket();
      forumSocketService.disconnect();
    }
  }, [isAuthenticated, isRestoringSession, isMaintenanceMode]);

  // Register for push notifications once logged in
  useEffect(() => {
    if (isAuthenticated && !isRestoringSession && !isMaintenanceMode && pushNotifEnabled) {
      registerForPushNotifications().then((token) => {
        if (token) saveDeviceToken(token);
      });
    }
  }, [isAuthenticated, isRestoringSession, isMaintenanceMode, pushNotifEnabled]);

  if (isRestoringSession) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#500088" />
      </View>
    );
  }

  // If system is currently undergoing maintenance, display maintenance screen
  if (isMaintenanceMode) {
    return <MaintenanceScreen onRetry={checkMaintenanceStatus} />;
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

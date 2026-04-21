import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { useAuthStore } from '@store/authStore';
import { getMe } from '@services/authService';
import { REFRESH_TOKEN_KEY } from '@services/apiClient';

// ─────────────────────────────────────────────────────────
// RootNavigator
// Reactively switches between Auth and Main stacks based on
// in-memory auth state (Zustand). When isAuthenticated flips
// to true (after login) or false (after logout), React
// Navigation automatically re-renders the correct stack.
// ─────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUser = useAuthStore((s) => s.setUser);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

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
        const user = await getMe();
        if (isMounted) {
          setUser(user);
        }
      } catch {
        // No active session to restore.
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

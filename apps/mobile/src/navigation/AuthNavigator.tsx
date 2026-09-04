import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@screens/auth/WelcomeScreen';
import SplashScreen from '@screens/auth/SplashScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';
import AccountSuspendedScreen from '@screens/auth/AccountSuspendedScreen';
import VerifyEmailScreen from '@screens/auth/VerifyEmailScreen';
import LegalScreen from '@screens/legal/LegalScreen';

// ─────────────────────────────────────────────────────────
// Auth Navigator
//
// Flow: Splash → Welcome (Sign Up / Login) → ForgotPassword (optional)
//
// After a successful signup or login the auth store sets
// isAuthenticated = true and RootNavigator automatically
// switches to the Main stack (Accessibility first).
// ─────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  ForgotPassword: undefined;
  // Reachable when a user logs in with an unverified account (no session yet).
  VerifyEmail: { email: string } | undefined;
  AccountSuspended: {
    permanent: boolean;
    suspendedUntil: string | null;
    reason: string | null;
  };
  // Terms / Privacy shown in-app rather than opening an external URL.
  Legal: { doc: 'terms' | 'privacy' };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <Stack.Screen name="AccountSuspended" component={AccountSuspendedScreen} />
      <Stack.Screen name="Legal" component={LegalScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

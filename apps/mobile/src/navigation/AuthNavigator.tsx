import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@screens/auth/WelcomeScreen';
import SplashScreen from '@screens/auth/SplashScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';

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
    </Stack.Navigator>
  );
};

export default AuthNavigator;

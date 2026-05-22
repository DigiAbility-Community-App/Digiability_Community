import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@screens/auth/WelcomeScreen';
import SplashScreen from '@screens/auth/SplashScreen';

// ─────────────────────────────────────────────────────────
// Auth Navigator (email/password flow)
//
// Screens:
//   Splash   → animated brand screen
//   Welcome  → Sign Up (name/email/password) + Login tabs
// ─────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  // If user is authenticated but not verified, jump straight to OTP
  const initialRoute = (isAuthenticated && user && !user.isEmailVerified) ? 'Otp' : 'Splash';

  // We provide default params for Otp if they jump straight there from a restored session
  const initialParams = initialRoute === 'Otp' ? { email: user!.email, name: user!.name } : undefined;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

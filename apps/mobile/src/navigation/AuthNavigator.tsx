import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@screens/auth/WelcomeScreen';
import SplashScreen from '@screens/auth/SplashScreen';
import PhoneInputScreen from '@screens/auth/PhoneInputScreen';
import OtpScreen from '@screens/auth/OtpScreen';

// ─────────────────────────────────────────────────────────
// Auth Navigator (email/password flow)
//
// Screens:
//   Splash        → animated brand screen
//   Welcome       → Sign Up (name/email/password) + Login tabs
//   PhoneInput/Otp → legacy placeholders kept for compatibility
// ─────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  PhoneInput: undefined;
  Otp: { phone: string };
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
      <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  );
};

export default AuthNavigator;

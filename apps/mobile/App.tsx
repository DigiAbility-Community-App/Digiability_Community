import 'react-native-gesture-handler';
import React, { useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import RootNavigator from '@navigation/RootNavigator';
import { AppThemeProvider } from './src/theme/ThemeContext';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef}>
          <AppThemeProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AppThemeProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Register as the root component so Metro bundler correctly wires the app
// Since package.json main points directly to App.tsx instead of expo/AppEntry.js
registerRootComponent(App);

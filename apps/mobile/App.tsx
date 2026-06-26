import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import * as Notifications from 'expo-notifications';
import RootNavigator from '@navigation/RootNavigator';
import { AppThemeProvider } from './src/theme/ThemeContext';
import {
  registerForPushNotifications,
  saveDeviceToken,
  addNotificationResponseListener,
} from './src/services/notificationService';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    // Register for push notifications on app start
    registerForPushNotifications().then((token) => {
      if (token) saveDeviceToken(token);
    });

    // Navigate when user taps a notification
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (!navigationRef.current) return;

      if (data.type === 'forum_answer' && data.questionId) {
        navigationRef.current.navigate('Main', {
          screen: 'Community',
          params: { screen: 'ForumThread', params: { questionId: data.questionId } },
        });
      } else if (data.conversationId) {
        navigationRef.current.navigate('Main', {
          screen: 'Chats',
          params: { screen: 'GroupChat', params: { conversationId: data.conversationId } },
        });
      }
    });

    return () => sub.remove();
  }, []);

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

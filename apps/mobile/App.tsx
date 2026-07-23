import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import RootNavigator from '@navigation/RootNavigator';
import { AppThemeProvider } from './src/theme/ThemeContext';
import { addNotificationResponseListener } from '@services/notificationService';
import { useChatStore } from '@store/chatStore';
import { useAuthStore } from '@store/authStore';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Push registration lives in RootNavigator (gated on auth) — this effect
  // only reacts to notification taps, which is safe to mount unconditionally.
  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (!navigationRef.current) return;

      if (data.type === 'forum_answer' && data.questionId) {
        navigationRef.current.navigate('Main', {
          screen: 'QuestionDetails',
          params: { questionId: data.questionId },
        });
        return;
      }

      if (data.conversationId) {
        const conversation = useChatStore.getState().conversations[data.conversationId];
        if (conversation?.type === 'DIRECT') {
          const myUserId = useAuthStore.getState().user?.id;
          const other = conversation.participants.find((p) => p.userId !== myUserId)?.user;
          navigationRef.current.navigate('Main', {
            screen: 'Chats',
            params: {
              screen: 'Chat',
              params: {
                conversationId: data.conversationId,
                recipientName: other?.name ?? '',
                recipientAvatar: other?.avatarUrl,
              },
            },
          });
        } else {
          navigationRef.current.navigate('Main', {
            screen: 'Chats',
            params: {
              screen: 'GroupChat',
              params: {
                conversationId: data.conversationId,
                groupName: conversation?.name ?? '',
                subType: conversation?.subType,
              },
            },
          });
        }
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

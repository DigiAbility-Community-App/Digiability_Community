import 'react-native-gesture-handler';
import React, { Component, ErrorInfo, ReactNode, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Caught runtime error:', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.message || 'An unexpected error occurred while starting the app.'}
          </Text>
          <TouchableOpacity style={errorStyles.button} onPress={this.handleRestart}>
            <Text style={errorStyles.buttonText}>Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Push registration lives in RootNavigator (gated on auth) — this effect
  // only reacts to notification taps, which is safe to mount unconditionally.
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      sub = addNotificationResponseListener((response) => {
        const data = response?.notification?.request?.content?.data as Record<string, string> | undefined;
        if (!navigationRef.current || !data) return;

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
            const other = conversation.participants?.find((p) => p.userId !== myUserId)?.user;
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
    } catch (e) {
      console.warn('[App] Failed to attach notification response listener:', e);
    }

    return () => {
      try {
        sub?.remove();
      } catch {}
    };
  }, []);

  return (
    <RootErrorBoundary>
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
    </RootErrorBoundary>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1B20',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#500088',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

// Register as the root component so Metro bundler correctly wires the app
// Since package.json main points directly to App.tsx instead of expo/AppEntry.js
registerRootComponent(App);

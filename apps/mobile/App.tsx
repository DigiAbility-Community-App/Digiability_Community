import 'react-native-gesture-handler';
// First: validates backend URLs and throws at startup if a production build
// is misconfigured (see src/config/env.ts).
import '@config/env';
import React, { Component, ErrorInfo, ReactNode, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import RootNavigator from '@navigation/RootNavigator';
import { AppThemeProvider } from './src/theme/ThemeContext';
import type { NotificationResponse } from 'expo-notifications';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  addNotificationResponseListener,
  consumeLaunchNotificationResponse,
} from '@services/notificationService';
import {
  routeNotificationTap,
  flushPendingNotificationRoute,
  clearPendingNotificationRoute,
} from '@navigation/notificationRouting';
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
  // Taps are validated and auth-gated in notificationRouting.ts.
  useEffect(() => {
    // The launch tap can also be delivered to the listener on some platforms;
    // route each notification once.
    const handled = new Set<string>();
    const handle = (response: NotificationResponse | null) => {
      const id = response?.notification?.request?.identifier;
      if (!response || (id && handled.has(id))) return;
      if (id) handled.add(id);
      // Held as pending inside routeNotificationTap until the signed-in UI
      // has mounted, so calling this before session restore is safe.
      routeNotificationTap(
        navigationRef.current,
        response.notification?.request?.content?.data,
      ).catch(() => {});
    };

    let sub: { remove: () => void } | null = null;
    try {
      sub = addNotificationResponseListener(handle);
      handle(consumeLaunchNotificationResponse());
    } catch (e) {
      console.warn('[App] Failed to attach notification response listener:', e);
    }

    // A tap held while signed out must never fire for whoever signs in next.
    const unsubscribeAuth = useAuthStore.subscribe((state) => {
      if (!state.isAuthenticated) clearPendingNotificationRoute();
    });

    return () => {
      try {
        sub?.remove();
      } catch {}
      unsubscribeAuth();
    };
  }, []);

  return (
    <RootErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* One keyboard system for the whole app: KeyboardAwareScrollView /
              SheetKeyboardAvoidingView (react-native-keyboard-controller)
              read the keyboard from here, including inside RN Modals. */}
          <KeyboardProvider>
            <NavigationContainer
              ref={navigationRef}
              // Replays a notification tap held until the signed-in UI mounted.
              onStateChange={() => {
                flushPendingNotificationRoute(navigationRef.current).catch(() => {});
              }}
            >
              <AppThemeProvider>
                <StatusBar style="light" />
                <RootNavigator />
              </AppThemeProvider>
            </NavigationContainer>
          </KeyboardProvider>
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

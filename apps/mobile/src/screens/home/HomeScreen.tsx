import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { logout } from '@services/authService';
import { useAuthStore } from '@store/authStore';

const HomeScreen = () => {
  const user = useAuthStore((s) => s.user);

  const handleLogout = async () => {
    await logout();
    // RootNavigator auto-switches to Auth when isAuthenticated → false
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome back 👋</Text>
      <Text style={styles.name}>{user?.name ?? '—'}</Text>
      <Text style={styles.email}>{user?.email ?? '—'}</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#500088',
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginBottom: 40,
  },
  logoutBtn: {
    backgroundColor: '#500088',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default HomeScreen;

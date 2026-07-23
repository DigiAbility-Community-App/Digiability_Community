import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import AuthLayout from '@/layouts/AuthLayout';
import Login from '@/features/auth/Login';
import Register from '@/features/auth/Register';
import VerifyEmail from '@/features/auth/VerifyEmail';
import AccountSuspended from '@/features/auth/AccountSuspended';
import OnboardingLayout from '@/layouts/OnboardingLayout';
import Accessibility from '@/features/onboarding/Accessibility';
import RoleSelection from '@/features/onboarding/RoleSelection';
import ProfileCompletion from '@/features/onboarding/ProfileCompletion';

import ChatsLayout from '@/features/chats/ChatsLayout';
import ChatView from '@/features/chats/ChatView';
import MentorsPage from '@/features/mentors/MentorsPage';
import ForumsPage from '@/features/forums/ForumsPage';
import EventsPage from '@/features/events/EventsPage';
import ServicesPage from '@/features/services/ServicesPage';
import LearnPage from '@/features/learn/LearnPage';
import SettingsPage from '@/features/settings/SettingsPage';
import PrivacyDataPage from '@/features/settings/PrivacyDataPage';

import PrivacyPolicy from '@/features/legal/PrivacyPolicy';
import TermsOfService from '@/features/legal/TermsOfService';
import { useAuthStore } from '@/store/authStore';
import { authService } from '@/services/authService';

const App = () => {
  const [isRestoring, setIsRestoring] = useState(true);
  const setUser = useAuthStore(s => s.setUser);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const user = await authService.getMe();
        setUser(user);
      } catch (err) {
        console.warn("Failed to restore session:", err);
      } finally {
        setIsRestoring(false);
      }
    };

    restoreSession();
  }, [setUser]);

  if (isRestoring) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={isAuthenticated ? "/app/chats" : "/login"} replace />} />
        
        {/* Auth Layout (Public) */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="account-suspended" element={<AccountSuspended />} />
        </Route>

        {/* Onboarding Layout (Authenticated but incomplete) */}
        <Route path="/onboarding" element={<OnboardingLayout />}>
          <Route path="accessibility" element={<Accessibility />} />
          <Route path="role" element={<RoleSelection />} />
          <Route path="profile" element={<ProfileCompletion />} />
        </Route>

        {/* Main App Layout (Authenticated) */}
        <Route path="/app" element={<MainLayout />}>
          <Route path="chats" element={<ChatsLayout />}>
            <Route path=":conversationId" element={<ChatView />} />
          </Route>
          <Route path="groups" element={<ChatsLayout />}>
            <Route path=":conversationId" element={<ChatView />} />
          </Route>
          <Route path="care-circles" element={<ChatsLayout />}>
            <Route path=":conversationId" element={<ChatView />} />
          </Route>
          <Route path="mentors" element={<MentorsPage />} />
          <Route path="forums" element={<ForumsPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/privacy" element={<PrivacyDataPage />} />
        </Route>
        
        {/* Legal / Privacy (public, no auth required) */}
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<TermsOfService />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/app/chats" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

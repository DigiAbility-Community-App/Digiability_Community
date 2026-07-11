import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import './AuthLayout.css';

const OnboardingLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (user && !user.isEmailVerified) {
      navigate('/verify-email');
      return;
    }

    const pendingRoles = useAuthStore.getState().pendingRoles;
    const hasRoles = (user && user.roles && user.roles.length > 0) || (pendingRoles && pendingRoles.length > 0);

    // Determine correct step
    if (user && !hasRoles) {
      if (location.pathname !== '/onboarding/accessibility' && location.pathname !== '/onboarding/role') {
        navigate('/onboarding/accessibility');
      }
    } else if (user && !user.profileComplete) {
      if (location.pathname !== '/onboarding/profile') {
        navigate('/onboarding/profile');
      }
    } else if (user && user.profileComplete) {
      navigate('/app/chats');
    }
  }, [isAuthenticated, user, navigate, location.pathname]);

  if (!isAuthenticated) return null;

  return (
    <div className="auth-container" style={{ overflowY: 'auto', padding: '2rem 0' }}>
      <main className="auth-card" style={{ maxWidth: '600px', width: '90%', margin: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default OnboardingLayout;

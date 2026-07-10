import { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { MessageSquare, Users, Calendar, Settings, Layers, HeartHandshake, GraduationCap } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/authStore';
import { initSocket, closeSocket } from '@/services/socketService';
import { authService } from '@/services/authService';
import './MainLayout.css';

const MainLayout = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const user = useAuthStore(s => s.user);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user && !user.isEmailVerified) {
      navigate('/verify-email');
    } else {
      initSocket();
    }
    return () => {
      // Don't close socket immediately on unmount of layout
      // Let auth state or logout handle it
    };
  }, [isAuthenticated, user?.isEmailVerified, navigate]);

  if (!isAuthenticated) return null;

  return (
    <div className="layout-container">
      {/* Sidebar Rail */}
      <nav className="sidebar" aria-label="Main Navigation">
        <div className="sidebar-logo">
          D
        </div>

        <div className="nav-links">
          <NavLink 
            to="/app/chats" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Chats"
            title="Chats"
          >
            <MessageSquare size={22} />
          </NavLink>

          <NavLink 
            to="/app/groups" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Groups"
            title="Groups"
          >
            <Layers size={22} />
          </NavLink>

          <NavLink
            to="/app/care-circles"
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Care Circles"
            title="Care Circles"
          >
            <HeartHandshake size={22} />
          </NavLink>

          <NavLink
            to="/app/mentors" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Mentors"
            title="Mentors"
          >
            <Users size={22} />
          </NavLink>

          <NavLink 
            to="/app/forums" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Forums"
            title="Forums"
          >
            <MessageSquare size={22} />
          </NavLink>

          <NavLink 
            to="/app/events" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Events"
            title="Events"
          >
            <Calendar size={22} />
          </NavLink>

          <NavLink 
            to="/app/services" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Services"
            title="Services"
          >
            <HeartHandshake size={22} />
          </NavLink>

          <NavLink 
            to="/app/learn" 
            className={({ isActive }) => clsx("nav-item", { active: isActive })}
            aria-label="Learn"
            title="Learn"
          >
            <GraduationCap size={22} />
          </NavLink>
        </div>

        <div className="sidebar-bottom">
          <button className="nav-item" aria-label="Settings" title="Settings">
            <Settings size={22} />
          </button>
          
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button 
              className="avatar-btn" 
              aria-label="User Profile" 
              title="Profile"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'User'}`} 
                alt="Avatar" 
                width="100%" 
                height="100%" 
              />
            </button>

            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <span className="profile-name">{user?.name}</span>
                  <span className="profile-email">{user?.email}</span>
                </div>
                <div className="profile-roles">
                  {user?.roles?.map(r => (
                    <span key={r} className="profile-role-badge">{r}</span>
                  ))}
                </div>
                <button 
                  className="profile-logout-btn"
                  onClick={() => {
                    authService.logout();
                    closeSocket();
                    navigate('/login');
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-wrapper">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;


import { Outlet } from 'react-router-dom';
import './AuthLayout.css';

const AuthLayout = () => {
  return (
    <div className="auth-container">
      <main className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">D</div>
          <h1 className="auth-title">Welcome to Digiability</h1>
          <p className="auth-subtitle">Connecting the differently abled community</p>
        </div>
        
        <Outlet />
        
      </main>
    </div>
  );
};

export default AuthLayout;

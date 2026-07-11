import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './Accessibility.css';

const defaultPreferences = {
  textSize: 'Medium',
  highContrast: false,
  screenReader: false,
  reduceMotion: false,
  pushNotif: true,
  emailNotif: true,
};

const Accessibility = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [loading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const saved = localStorage.getItem(`accessibility_${user.id}`);
      if (saved) {
        try {
          setPreferences({ ...defaultPreferences, ...JSON.parse(saved) });
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, [user?.id]);

  const updatePref = (key: keyof typeof defaultPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleContinue = () => {
    if (user?.id) {
      localStorage.setItem(`accessibility_${user.id}`, JSON.stringify(preferences));
    }
    
    // Navigate to next step
    if (!user?.roles || user.roles.length === 0) {
      navigate('/onboarding/role');
    } else if (!user?.profileComplete) {
      navigate('/onboarding/profile');
    } else {
      navigate('/app/chats');
    }
  };

  const highContrastClass = preferences.highContrast ? 'high-contrast' : '';

  return (
    <div className={`accessibility-container ${highContrastClass}`}>
      <div className="onboarding-header">
        <div className="progress-bar">
          <div className="progress-step active" />
          <div className="progress-step" />
          <div className="progress-step" />
        </div>
      </div>
      
      <div className="onboarding-content">
        <h1 className="onboarding-title">Accessibility Preferences</h1>
        <p className="onboarding-subtitle">Customize the app for your needs</p>
        
        <section className="onboarding-section">
          <h2 className="section-label">VISUAL</h2>
          
          <div className="preference-card">
            <div className="pref-info">
              <h3>Text Size</h3>
              <p>Adjust font size for better readability</p>
            </div>
            <div className="segment-control">
              {['Small', 'Medium', 'Large'].map(size => (
                <button
                  key={size}
                  type="button"
                  className={`segment-btn ${preferences.textSize === size ? 'active' : ''}`}
                  onClick={() => updatePref('textSize', size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          
          <div className="preference-card horizontal">
            <div className="pref-info">
              <h3>High Contrast</h3>
              <p>Improve visibility with stronger colors</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={preferences.highContrast} 
                onChange={(e) => updatePref('highContrast', e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="preference-card horizontal">
            <div className="pref-info">
              <h3>Screen Reader</h3>
              <p>Enable spoken feedback support</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={preferences.screenReader} 
                onChange={(e) => updatePref('screenReader', e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="preference-card horizontal">
            <div className="pref-info">
              <h3>Reduce Motion</h3>
              <p>Minimize animations and transitions</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={preferences.reduceMotion} 
                onChange={(e) => updatePref('reduceMotion', e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>

        <section className="onboarding-section">
          <h2 className="section-label">NOTIFICATIONS</h2>
          
          <div className="preference-card horizontal">
            <div className="pref-info">
              <h3>Push Notifications</h3>
              <p>Receive important updates instantly</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={preferences.pushNotif} 
                onChange={(e) => updatePref('pushNotif', e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>

          <div className="preference-card horizontal">
            <div className="pref-info">
              <h3>Email Notifications</h3>
              <p>Receive updates through email</p>
            </div>
            <label className="toggle-switch">
              <input 
                type="checkbox" 
                checked={preferences.emailNotif} 
                onChange={(e) => updatePref('emailNotif', e.target.checked)} 
              />
              <span className="slider round"></span>
            </label>
          </div>
        </section>
        
        <button 
          className="btn-primary" 
          onClick={handleContinue}
          disabled={loading}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default Accessibility;

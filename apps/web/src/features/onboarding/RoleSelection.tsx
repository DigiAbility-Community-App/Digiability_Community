import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import './RoleSelection.css';

const roles = [
  { id: 'pwd', title: 'PwD', subtitle: 'I have a disability', icon: '♿' },
  { id: 'caregiver', title: 'Caregiver', subtitle: 'I care for someone', icon: '♡' },
  { id: 'educator', title: 'Educator', subtitle: 'I teach or do therapy', icon: '📖' },
  { id: 'ngo_worker', title: 'NGO Worker', subtitle: 'I work with an NGO', icon: '🏢' },
  { id: 'skill_trainer', title: 'Skill Trainer', subtitle: 'I train or hire PwDs', icon: '💼' },
  { id: 'community_member', title: 'Community Member', subtitle: 'I want to support', icon: '👥' },
];

const RoleSelection = () => {
  const navigate = useNavigate();
  const setPendingRoles = useAuthStore(s => s.setPendingRoles);
  const user = useAuthStore(s => s.user);

  const [selected, setSelected] = useState<string[]>(user?.roles || []);

  const toggleRole = (roleId: string) => {
    setSelected(prev => 
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleContinue = () => {
    if (selected.length === 0) return;
    setPendingRoles(selected);
    navigate('/onboarding/profile');
  };

  return (
    <div className="role-selection-container">
      <div className="onboarding-header">
        <div className="progress-bar">
          <div className="progress-step" />
          <div className="progress-step active" />
          <div className="progress-step" />
        </div>
      </div>
      
      <div className="onboarding-content">
        <h1 className="onboarding-title">I am a...</h1>
        <p className="onboarding-subtitle">Select the role that best describes you.</p>

        <div className="role-grid">
          {roles.map(role => {
            const isSelected = selected.includes(role.id);
            return (
              <button
                key={role.id}
                className={`role-card ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleRole(role.id)}
                type="button"
              >
                {isSelected && (
                  <div className="check-circle">✓</div>
                )}
                <div className="role-icon">{role.icon}</div>
                <h3 className="role-title">{role.title}</h3>
                <p className="role-subtitle">{role.subtitle}</p>
              </button>
            );
          })}
        </div>
        
        <p className="note-text">You can update your roles anytime in Profile</p>

        <button 
          className="btn-primary" 
          onClick={handleContinue}
          disabled={selected.length === 0}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;

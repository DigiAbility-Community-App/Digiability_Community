import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import './SettingsPage.css';

const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-list">
        <button
          className="settings-row"
          onClick={() => navigate('/app/settings/privacy')}
        >
          <div className="settings-row-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="settings-row-text">
            <h3>Privacy & Data</h3>
            <p>Manage consent, export, and delete your data</p>
          </div>
          <ChevronRight size={18} className="settings-row-chevron" />
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;

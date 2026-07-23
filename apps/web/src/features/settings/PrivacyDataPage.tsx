import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { authService } from '../../services/authService';
import {
  privacyService,
  type ConsentRecord,
  type ConsentType,
} from '../../services/privacyService';
import './PrivacyDataPage.css';

const OPTIONAL_CONSENTS: { type: ConsentType; title: string; description: string }[] = [
  {
    type: 'PUSH_NOTIFICATIONS',
    title: 'Push Notifications',
    description: 'Allow us to send you push alerts for messages and activity.',
  },
  {
    type: 'MARKETING',
    title: 'Marketing',
    description: 'Allow us to send newsletters and promotional emails.',
  },
];

const PrivacyDataPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentBusy, setConsentBusy] = useState<Partial<Record<ConsentType, boolean>>>({});
  const [exporting, setExporting] = useState(false);
  const [confirmStage, setConfirmStage] = useState<0 | 1>(0);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    privacyService.getConsents()
      .then(setConsents)
      .catch(() => setError('Could not load your privacy settings. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const isAccepted = (type: ConsentType) =>
    consents.find(c => c.consentType === type)?.accepted ?? false;

  const handleToggle = async (type: ConsentType, value: boolean) => {
    setConsents(prev => prev.map(c => (c.consentType === type ? { ...c, accepted: value } : c)));
    setConsentBusy(prev => ({ ...prev, [type]: true }));
    try {
      await privacyService.updateConsent(type, value);
    } catch {
      setConsents(prev => prev.map(c => (c.consentType === type ? { ...c, accepted: !value } : c)));
      setError('Could not update this preference. Please try again.');
    } finally {
      setConsentBusy(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const bundle = await privacyService.exportMyData();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `digiability-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      await authService.deleteAccount();
      navigate('/login');
    } catch {
      setDeleting(false);
      setError('Could not delete your account. Please try again.');
    }
  };

  return (
    <div className="privacy-container">
      <div className="privacy-header">
        <button className="privacy-back-btn" onClick={() => navigate('/app/settings')} aria-label="Back to Settings">
          <ArrowLeft size={20} />
        </button>
        <h1>Privacy & Data</h1>
      </div>

      {error && <div className="privacy-error">{error}</div>}

      <section className="privacy-section">
        <h2 className="privacy-section-title">Your Consents</h2>

        <div className="privacy-card">
          <div className="privacy-row">
            <div className="privacy-row-text">
              <h3><Lock size={14} /> Data Processing</h3>
              <p>Required to operate your account. To stop this, delete your account below.</p>
            </div>
            <span className="privacy-required-badge">Required</span>
          </div>
        </div>

        {OPTIONAL_CONSENTS.map(({ type, title, description }) => (
          <div className="privacy-card" key={type}>
            <div className="privacy-row">
              <div className="privacy-row-text">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <label className="privacy-toggle-switch">
                <input
                  type="checkbox"
                  checked={isAccepted(type)}
                  disabled={loading || !!consentBusy[type]}
                  onChange={(e) => handleToggle(type, e.target.checked)}
                  aria-label={title}
                />
                <span className="privacy-slider" />
              </label>
            </div>
          </div>
        ))}
      </section>

      <section className="privacy-section">
        <h2 className="privacy-section-title">Your Data</h2>
        <div className="privacy-card">
          <p className="privacy-card-body">
            Download a copy of the personal data we hold about you, including your profile, mentor
            activity, and consent history. Messages and forum posts live on separate services and
            aren't included here — contact support if you need those too.
          </p>
          <button className="privacy-btn privacy-btn-outline" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Preparing export…' : 'Export my data'}
          </button>
        </div>
      </section>

      <section className="privacy-section">
        <h2 className="privacy-section-title privacy-danger-title">Danger Zone</h2>
        <div className="privacy-card privacy-danger-card">
          <p className="privacy-card-body">
            Deleting your account deactivates it immediately and anonymises your profile,
            preferences, messages, and forum posts. Some records are retained, marked as deleted,
            as required by law.
          </p>

          {confirmStage === 0 ? (
            <button className="privacy-btn privacy-btn-danger" onClick={() => setConfirmStage(1)} disabled={deleting}>
              Delete my account
            </button>
          ) : (
            <div className="privacy-confirm-panel">
              <p className="privacy-confirm-text">
                This cannot be undone from within the app. Are you absolutely sure?
              </p>
              <div className="privacy-confirm-actions">
                <button className="privacy-btn privacy-btn-outline" onClick={() => setConfirmStage(0)} disabled={deleting}>
                  No, keep my account
                </button>
                <button className="privacy-btn privacy-btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? 'Deleting account…' : 'Yes, delete my account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default PrivacyDataPage;

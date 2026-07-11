import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { checkUsernameAvailability, submitFullOnboarding, parseDateInput } from '../../services/profileService';
import { AlertCircle, CheckCircle } from 'lucide-react';
import './ProfileCompletion.css';

const ProfileCompletion = () => {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const pendingRoles = useAuthStore(s => s.pendingRoles);
  const setUser = useAuthStore(s => s.setUser);
  
  const roles = pendingRoles.length > 0 ? pendingRoles : (user?.roles || []);

  const [fullName, setFullName] = useState(user?.name || '');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [phoneNo, setPhoneNo] = useState('');

  // Role-specific fields — required by the backend before it will mark the
  // profile complete (see hasRequiredRoleFields in user-svc). Frontend role
  // ids here match RoleSelection.tsx ('educator' = therapist, 'ngo_worker' = ngo).
  const [disabilityType, setDisabilityType] = useState('');
  const [carePersonName, setCarePersonName] = useState('');
  const [speciality, setSpeciality] = useState('');
  const [ngoName, setNgoName] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg, setUsernameMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (roles.length === 0) {
      navigate('/onboarding/role');
    }
  }, [roles, navigate]);

  const handleUsernameChange = (val: string) => {
    setUsername(val);
    const clean = val.trim().toLowerCase().replace(/^@+/, '');
    
    if (!clean) {
      setUsernameStatus('idle');
      setUsernameMsg('');
      return;
    }
    
    if (!/^[a-z0-9_.]{3,20}$/.test(clean)) {
      setUsernameStatus('invalid');
      setUsernameMsg('3-20 lowercase letters, numbers, _ or .');
      return;
    }
    
    setUsernameStatus('checking');
    setUsernameMsg('Checking...');
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await checkUsernameAvailability(clean);
      setUsernameStatus(res.available ? 'available' : 'taken');
      setUsernameMsg(res.message);
    }, 500);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    
    if (!fullName.trim() || !username.trim()) {
      setError('Name and Username are required');
      return;
    }
    
    if (usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError('Please provide a valid, available username');
      return;
    }

    if (roles.includes('pwd') && !disabilityType.trim()) {
      setError('Please tell us your disability type.');
      return;
    }
    if (roles.includes('caregiver') && !carePersonName.trim()) {
      setError("Please tell us who you're caring for.");
      return;
    }
    if (roles.includes('educator') && !speciality.trim()) {
      setError('Please tell us your speciality.');
      return;
    }
    if (roles.includes('ngo_worker') && !ngoName.trim()) {
      setError('Please tell us your NGO name.');
      return;
    }

    const parsedDob = dob.trim() ? parseDateInput(dob.trim(), 'DMY') : undefined;
    if (dob.trim() && !parsedDob) {
      setError('Invalid date format (DD/MM/YYYY)');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const roleDetails: Record<string, string> = {};
      if (roles.includes('pwd')) roleDetails.disabilityType = disabilityType.trim();
      if (roles.includes('caregiver')) roleDetails.carePersonName = carePersonName.trim();
      if (roles.includes('educator')) roleDetails.speciality = speciality.trim();
      if (roles.includes('ngo_worker')) roleDetails.ngoName = ngoName.trim();

      await submitFullOnboarding({
        userId: user.id,
        roles,
        basicProfile: {
          fullName: fullName.trim(),
          username: username.trim().toLowerCase(),
          dob: parsedDob,
          phoneNo: phoneNo.trim() || undefined,
        },
        roleDetails,
      });
      
      setUser({
        ...user,
        name: fullName.trim(),
        roles,
        profileComplete: true,
      });
      
      navigate('/app/chats');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="profile-completion-container" onSubmit={handleComplete}>
      <div className="onboarding-header">
        <div className="progress-bar">
          <div className="progress-step" />
          <div className="progress-step" />
          <div className="progress-step active" />
        </div>
      </div>
      
      <div className="onboarding-content">
        <h1 className="onboarding-title">Tell us about yourself</h1>
        <p className="onboarding-subtitle">Complete your profile to join the community</p>

        {error && (
          <div className="error-message" role="alert" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            placeholder="Choose a unique username"
            value={username}
            onChange={e => handleUsernameChange(e.target.value)}
            disabled={isLoading}
            required
          />
          {usernameStatus !== 'idle' && (
            <div className={`username-status ${usernameStatus}`}>
              {usernameStatus === 'available' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{usernameMsg}</span>
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Date of Birth (Optional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="DD/MM/YYYY"
            value={dob}
            onChange={e => setDob(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Phone Number (Optional)</label>
          <input
            type="tel"
            className="form-input"
            placeholder="+91 XXXXX XXXXX"
            value={phoneNo}
            onChange={e => setPhoneNo(e.target.value)}
            disabled={isLoading}
          />
        </div>

        {roles.includes('pwd') && (
          <div className="form-group">
            <label className="form-label">Disability Type</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Visual impairment, Mobility, Hearing..."
              value={disabilityType}
              onChange={e => setDisabilityType(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        {roles.includes('caregiver') && (
          <div className="form-group">
            <label className="form-label">Who are you caring for?</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name of the person you care for"
              value={carePersonName}
              onChange={e => setCarePersonName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        {roles.includes('educator') && (
          <div className="form-group">
            <label className="form-label">Speciality</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Speech therapy, Special education..."
              value={speciality}
              onChange={e => setSpeciality(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        {roles.includes('ngo_worker') && (
          <div className="form-group">
            <label className="form-label">NGO Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Name of your organization"
              value={ngoName}
              onChange={e => setNgoName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="btn-primary" 
          disabled={isLoading || usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'}
        >
          {isLoading ? 'Saving...' : 'Complete Profile'}
        </button>
      </div>
    </form>
  );
};

export default ProfileCompletion;

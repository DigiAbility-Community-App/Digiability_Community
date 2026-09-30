
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authService } from '../../services/authService';
import { isOldEnough, maxEligibleBirthDateISO, MINIMUM_AGE } from '../../utils/ageValidation';
import {
  evaluatePassword,
  firstPasswordError,
  FALLBACK_PASSWORD_POLICY,
  type PasswordPolicy,
} from '../../utils/passwordValidation';
import apiClient from '../../services/apiClient';
import { useEffect } from 'react';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // This form previously had no terms notice at all — not even the passive
  // caption the mobile app showed. Registration is now gated on it.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Digiability is an 18+ platform (DPDP §9). The server is the real gate.
  const [dateOfBirth, setDateOfBirth] = useState('');

  // Rules come from the admin's Password Policy (Settings) via user-svc, so
  // this form shows and applies exactly what the API enforces.
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(FALLBACK_PASSWORD_POLICY);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ success: boolean; data: PasswordPolicy }>('/api/master/password-policy')
      .then(({ data }) => {
        if (!cancelled && data.success && data.data) setPasswordPolicy(data.data);
      })
      .catch(() => {
        // keep FALLBACK_PASSWORD_POLICY
      });
    return () => { cancelled = true; };
  }, []);

  // Only relevant while the password field is being filled in — shown on
  // focus, collapsed on blur, so it doesn't sit permanently between the
  // password and date-of-birth fields.
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRules = evaluatePassword(password, passwordPolicy);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    const passwordError = firstPasswordError(password, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!dateOfBirth) {
      setError('Please enter your date of birth.');
      return;
    }
    if (!isOldEnough(new Date(dateOfBirth))) {
      setError(`You must be ${MINIMUM_AGE} or older to use Digiability Community.`);
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Use and Community Guidelines to continue.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.register(name, email, password, dateOfBirth);
      // Registration doesn't create a session any more, so the email can't be
      // read from the auth store on the next screen — pass it through.
      navigate('/verify-email', { state: { email } });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Registration failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister}>
      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="name" className="form-label">Full Name</label>
        <input
          id="name"
          type="text"
          className="form-input"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={isLoading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="email" className="form-label">Email Address</label>
        <input
          id="email"
          type="email"
          className="form-input"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          disabled={isLoading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="password" className="form-label">Password</label>
        <div className="password-input-wrapper">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            className="form-input"
            placeholder={`${passwordPolicy.minLength}\u2013${passwordPolicy.maxLength} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            required
            autoComplete="new-password"
            disabled={isLoading}
            style={{ paddingRight: '40px' }}
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={isLoading}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Revealed while the password field is focused, ticking off live —
            the list is the admin-configured policy the API will enforce. */}
        {passwordFocused && (
          <ul className="password-rules" aria-label="Password requirements">
            {passwordRules.map((rule) => (
              <li
                key={rule.key}
                className={rule.met ? 'password-rule met' : 'password-rule'}
              >
                <span className="password-rule-icon" aria-hidden="true">
                  {rule.met ? '\u2713' : '\u25CB'}
                </span>
                <span>{rule.label}</span>
                <span className="sr-only">{rule.met ? ' (met)' : ' (not met)'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="form-group">
        <label htmlFor="dateOfBirth" className="form-label">Date of Birth</label>
        <input
          id="dateOfBirth"
          type="date"
          className="form-input"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={maxEligibleBirthDateISO()}
          disabled={isLoading}
          required
          aria-describedby="dob-hint"
        />
        <small id="dob-hint" style={{ color: '#7D7387' }}>
          You must be {MINIMUM_AGE} or older to join.
        </small>
      </div>

      <div className="form-group">
        <label
          htmlFor="acceptedTerms"
          style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', lineHeight: 1.5 }}
        >
          <input
            id="acceptedTerms"
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            disabled={isLoading}
            style={{ marginTop: '3px', flexShrink: 0 }}
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="auth-link">Terms of Use</Link>
            {' '}and{' '}
            <Link to="/community-guidelines" target="_blank" className="auth-link">
              Community Guidelines
            </Link>
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={isLoading || !acceptedTerms}
        aria-busy={isLoading}
      >
        {isLoading ? 'Creating Account...' : 'Create Account'}
      </button>

      <div className="auth-footer">
        Already have an account?{' '}
        <Link to="/login" className="auth-link">
          Sign In
        </Link>
      </div>
    </form>
  );
};

export default Register;


import { useEffect, useRef, useState } from 'react';
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

type EmailStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Field errors from a 422 `{ errors: [{ field, message }] }` response. */
function fieldError(err: any, field: string): string | null {
  const errors: Array<{ field?: string; message?: string }> = err?.response?.data?.errors ?? [];
  return errors.find((e) => e.field === field)?.message ?? null;
}

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Shown under the password field rather than in the banner at the top.
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Live "already registered" check, debounced like the mobile app's, so the
  // user finds out while typing instead of after submitting the whole form.
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [emailMessage, setEmailMessage] = useState('');
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ignores a response for an address the user has since changed.
  const latestEmailRef = useRef('');

  useEffect(() => () => {
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
  }, []);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const trimmed = value.trim().toLowerCase();
    latestEmailRef.current = trimmed;
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);

    if (!trimmed) {
      setEmailStatus('idle');
      setEmailMessage('');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      // Don't nag mid-typing; the format message shows once the field is left.
      setEmailStatus('invalid');
      setEmailMessage('');
      return;
    }

    setEmailStatus('checking');
    setEmailMessage('Checking…');
    emailDebounceRef.current = setTimeout(async () => {
      const result = await authService.checkEmailAvailability(trimmed);
      if (latestEmailRef.current !== trimmed) return;
      setEmailStatus(!result.checked ? 'idle' : result.available ? 'available' : 'taken');
      setEmailMessage(result.checked ? result.message : '');
    }, 500);
  };
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // This form previously had no terms notice at all — not even the passive
  // caption the mobile app showed. Registration is now gated on it.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Separate, unticked consent to the data-processing notice (DPDP §5/§6).
  const [acceptedDataProcessing, setAcceptedDataProcessing] = useState(false);
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
    if (emailStatus === 'taken') {
      setError(emailMessage || 'An account with this email already exists.');
      return;
    }
    if (emailStatus === 'checking') {
      setError('Checking that email address, please wait…');
      return;
    }
    const passwordRuleError = firstPasswordError(password, passwordPolicy);
    if (passwordRuleError) {
      setPasswordError(passwordRuleError);
      document.getElementById('password')?.focus();
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
    if (!acceptedDataProcessing) {
      setError('Please consent to the processing of your data to create an account.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      await authService.register(name, email, password, dateOfBirth);
      // Registration doesn't create a session any more, so the email can't be
      // read from the auth store on the next screen — pass it through.
      navigate('/verify-email', { state: { email } });
    } catch (err: any) {
      // A 422 from the password policy carries the real reasons in errors[];
      // the top-level message is only "Validation failed".
      const serverPasswordError = fieldError(err, 'password');
      if (serverPasswordError) {
        setPasswordError(serverPasswordError);
        return;
      }
      const firstFieldMessage = err.response?.data?.errors?.[0]?.message;
      const msg = firstFieldMessage || err.response?.data?.message || err.message || 'Registration failed.';
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
          onChange={(e) => handleEmailChange(e.target.value)}
          onBlur={() => {
            if (emailStatus === 'invalid') setEmailMessage('Enter a valid email address');
          }}
          required
          autoComplete="email"
          disabled={isLoading}
          aria-invalid={emailStatus === 'taken' || (emailStatus === 'invalid' && !!emailMessage)}
          aria-describedby={emailMessage ? 'email-status' : undefined}
        />
        {emailMessage && (
          <p
            id="email-status"
            role={emailStatus === 'taken' ? 'alert' : 'status'}
            className={`field-status ${emailStatus === 'taken' || emailStatus === 'invalid' ? 'field-status-error' : emailStatus === 'available' ? 'field-status-ok' : ''}`}
          >
            {emailStatus === 'available' ? `\u2713 ${emailMessage}` : emailMessage}
          </p>
        )}
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
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            required
            autoComplete="new-password"
            disabled={isLoading}
            style={{ paddingRight: '40px' }}
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? 'password-error' : undefined}
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

        {passwordError && (
          <p id="password-error" role="alert" className="field-status field-status-error">
            {passwordError}
          </p>
        )}

        {/* Revealed while the password field is focused (or while a password
            error is showing), ticking off live — the list is the
            admin-configured policy the API will enforce. */}
        {(passwordFocused || !!passwordError) && (
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

      <div className="form-group">
        <label
          htmlFor="acceptedDataProcessing"
          style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', lineHeight: 1.5 }}
        >
          <input
            id="acceptedDataProcessing"
            type="checkbox"
            checked={acceptedDataProcessing}
            onChange={(e) => setAcceptedDataProcessing(e.target.checked)}
            disabled={isLoading}
            style={{ marginTop: '3px', flexShrink: 0 }}
          />
          <span>
            I consent to Digiability processing my personal data, including any disability
            information I choose to share, as described in{' '}
            <Link to="/data-processing-notice" target="_blank" className="auth-link">
              How we use your data
            </Link>
          </span>
        </label>
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={isLoading || !acceptedTerms || !acceptedDataProcessing}
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

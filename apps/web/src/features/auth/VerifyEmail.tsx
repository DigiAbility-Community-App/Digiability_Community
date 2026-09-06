import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../services/apiClient';
import './VerifyEmail.css';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const setAccessToken = useAuthStore(s => s.setAccessToken);

  // Registration no longer creates a session, so there may be no user in the
  // store yet — the email is passed through router state instead.
  const email = user?.email ?? (location.state as { email?: string } | null)?.email;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // If already verified, redirect
    if (user?.isEmailVerified) {
      if (!user.roles || user.roles.length === 0) {
        navigate('/onboarding/accessibility');
      } else if (!user.profileComplete) {
        navigate('/onboarding/profile');
      } else {
        navigate('/app/chats');
      }
    }
  }, [user, navigate]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // take last char
    setOtp(newOtp);
    if (error) setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      setOtp(pastedData.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length < 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }
    if (!email) {
      setError('Email not found. Please log in again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verification is now where the session begins — the server returns the
      // access token here rather than at registration.
      const res = await apiClient.post('/api/auth/verify-email', {
        email,
        otp: otpString,
      });

      const { accessToken, user: verifiedUser } = res.data.data ?? {};
      if (accessToken) setAccessToken(accessToken);

      const updatedUser = verifiedUser
        ? { ...verifiedUser, isEmailVerified: true }
        : { ...user, isEmailVerified: true };
      setUser(updatedUser as never);

      if (!updatedUser.roles || updatedUser.roles.length === 0) {
        navigate('/onboarding/accessibility');
      } else if (!updatedUser.profileComplete) {
        navigate('/onboarding/profile');
      } else {
        navigate('/app/chats');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email) return;
    setIsResending(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await apiClient.post('/api/auth/resend-otp', { email });
      setSuccess(res.data.message || 'A new OTP has been sent to your email.');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <form onSubmit={handleVerify} className="verify-form">
      <div className="verify-icon">
        <Mail size={36} />
      </div>

      <p className="verify-description">
        We sent a 6-digit code to{' '}
        <span className="verify-email-highlight">{user?.email}</span>.
        Enter it below to verify your account.
      </p>

      {error && (
        <div className="error-message" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="success-message" role="status">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="otp-input-group" onPaste={handlePaste}>
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            className="otp-digit"
            value={digit}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            autoFocus={index === 0}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={isLoading || otp.join('').length < 6}
      >
        {isLoading ? 'Verifying...' : 'Verify Email'}
      </button>

      <div className="resend-row">
        Didn't receive code?{' '}
        <button
          type="button"
          className="resend-btn"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? 'Sending...' : 'Resend OTP'}
        </button>
      </div>
    </form>
  );
};

export default VerifyEmail;

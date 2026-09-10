import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { authService } from '../../services/authService';

// ─────────────────────────────────────────────────────────────
// Public account deletion.
//
// Reachable WITHOUT signing in to the app, which is what Google Play's Data
// Safety declaration requires: a user who has uninstalled the app must still be
// able to delete their account and see what deletion does.
//
// It deliberately reuses the same DELETE /api/auth/delete-account the in-app
// flow calls — one deletion implementation, two entry points — so the two can
// never drift into doing different things.
//
// This route sits outside MainLayout in App.tsx; it must never be moved under
// an authenticated layout.
// ─────────────────────────────────────────────────────────────

export default function DeleteAccountPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      // Sign in first: deletion requires an authenticated session, and the
      // server re-checks the password before destroying anything.
      await authService.login(email, password);
      await authService.deleteAccount(password);
      setDone(true);
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? 'That email and password combination is incorrect.'
          : err?.response?.data?.message ||
              'Could not delete your account. Please try again, or contact support.'
      );
      setIsDeleting(false);
    }
  };

  if (done) {
    return (
      <main style={styles.main}>
        <div style={styles.doneBox}>
          <CheckCircle2 size={40} color="#16A34A" />
          <h1 style={styles.h1}>Your account has been deleted</h1>
          <p>
            Your profile, preferences, personal details and message content have been erased.
            A minimal registration record is kept for 180 days because Indian law requires it,
            and is then destroyed automatically.
          </p>
          <p>
            <Link to="/account-deletion-policy" style={styles.link}>
              Read the full Account Deletion and Retention policy
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Delete your DigiAbility account</h1>

      <p>
        You can delete your account here without opening the app. Deletion is immediate and
        cannot be undone.
      </p>

      <h2 style={styles.h2}>What is deleted straight away</h2>
      <ul>
        <li>Your name, email address, phone number and date of birth</li>
        <li>Your whole profile, including disability and caregiver information</li>
        <li>The content of every chat message you have sent</li>
        <li>Your sessions and notification tokens — you are signed out everywhere</li>
      </ul>

      <h2 style={styles.h2}>What is kept, and why</h2>
      <ul>
        <li>
          <strong>Your forum posts remain</strong>, shown as written by "Deleted User", so
          discussions other people took part in stay readable.
        </li>
        <li>
          <strong>A minimal registration record for 180 days.</strong> Indian intermediary rules
          require us to retain registration information for 180 days after cancellation. It is
          sealed away from the running service and destroyed automatically when the period ends.
        </li>
      </ul>

      <p>
        Full details are in our{' '}
        <Link to="/account-deletion-policy" style={styles.link}>
          Account Deletion and Retention policy
        </Link>
        .
      </p>

      <form onSubmit={handleSubmit} style={styles.form}>
        {error && (
          <div className="error-message" role="alert" style={styles.error}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isDeleting}
            autoComplete="email"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            id="password"
            type="password"
            className="form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isDeleting}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={isDeleting}
          aria-busy={isDeleting}
          style={styles.dangerBtn}
        >
          {isDeleting ? 'Deleting your account…' : 'Permanently delete my account'}
        </button>
      </form>

      <p style={styles.footnote}>
        Changed your mind? <Link to="/login" style={styles.link}>Sign in instead</Link>.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.7,
  },
  h1: { fontSize: '1.6rem', marginBottom: '0.5rem' },
  h2: { fontSize: '1.1rem', marginTop: '2rem' },
  form: { marginTop: '2rem' },
  error: { marginBottom: '1rem' },
  dangerBtn: { background: '#DC2626', borderColor: '#DC2626' },
  footnote: { marginTop: '1.5rem', fontSize: '0.9rem' },
  link: { color: '#7004DC', fontWeight: 600 },
  doneBox: { textAlign: 'center', paddingTop: '3rem' },
};

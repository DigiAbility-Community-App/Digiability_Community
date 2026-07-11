import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ban, Clock } from 'lucide-react';
import './AccountSuspended.css';

interface BanInfo {
  permanent: boolean;
  suspendedUntil: string | null;
  reason: string | null;
}

const STORAGE_KEY = 'digiability_ban_info';

export function stashBanInfo(info: BanInfo) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
}

function readBanInfo(): BanInfo | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BanInfo;
  } catch {
    return null;
  }
}

function formatRemaining(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return 'less than a minute';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours > 0 ? `, ${hours} hour${hours === 1 ? '' : 's'}` : ''}`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'}${minutes > 0 ? `, ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}`;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

const AccountSuspended = () => {
  const navigate = useNavigate();
  const [banInfo] = useState<BanInfo | null>(() => readBanInfo());

  useEffect(() => {
    // One-shot read — clear it so a manual refresh of this page after the
    // user logs into a *different* (non-banned) account doesn't reuse it.
    sessionStorage.removeItem(STORAGE_KEY);
    if (!banInfo) {
      navigate('/login', { replace: true });
    }
  }, [banInfo, navigate]);

  const untilDate = useMemo(
    () => (banInfo?.suspendedUntil ? new Date(banInfo.suspendedUntil) : null),
    [banInfo]
  );
  const [remaining, setRemaining] = useState(() => (untilDate ? formatRemaining(untilDate) : ''));

  useEffect(() => {
    if (!untilDate) return;
    const id = setInterval(() => setRemaining(formatRemaining(untilDate)), 60_000);
    return () => clearInterval(id);
  }, [untilDate]);

  if (!banInfo) return null;

  return (
    <div className="suspended-container">
      <div className="suspended-icon-circle">
        <Ban size={40} strokeWidth={2} />
      </div>

      <h2 className="suspended-title">
        {banInfo.permanent ? 'Account Suspended' : 'Account Temporarily Suspended'}
      </h2>

      <p className="suspended-message">
        {banInfo.reason || 'Your account has been suspended for violating our community guidelines.'}
      </p>

      {!banInfo.permanent && untilDate && (
        <div className="suspended-countdown">
          <Clock size={18} strokeWidth={2} />
          <span>Access restored in {remaining}</span>
        </div>
      )}

      {banInfo.permanent && (
        <p className="suspended-appeal">
          If you believe this was a mistake, please contact support at{' '}
          <a href="mailto:support@digiability.com">support@digiability.com</a>.
        </p>
      )}

      <button
        type="button"
        className="suspended-back-btn"
        onClick={() => navigate('/login', { replace: true })}
      >
        Back to login
      </button>
    </div>
  );
};

export default AccountSuspended;

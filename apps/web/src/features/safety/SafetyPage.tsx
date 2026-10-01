import { Link } from 'react-router-dom';
import { Phone, ShieldAlert, Flag, Ban } from 'lucide-react';
import { SAFETY_RESOURCES, EMERGENCY_NUMBER } from '../../utils/safetyResources';

// ─────────────────────────────────────────────────────────────
// Public safety resources page.
//
// The Community Guidelines point people in crisis at "digiability.org/safety".
// This is that page. Deliberately PUBLIC — someone looking for a crisis number
// should never have to sign in to find one.
//
// Ordered emergency → crisis → support so the most urgent number is first.
// ─────────────────────────────────────────────────────────────

const PRIORITY_ORDER = { emergency: 0, crisis: 1, support: 2 } as const;

export default function SafetyPage() {
  const sorted = [...SAFETY_RESOURCES].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Safety resources</h1>

      <div style={styles.banner} role="alert">
        <ShieldAlert size={20} color="#C53030" aria-hidden="true" />
        <p style={{ margin: 0 }}>
          If someone is in immediate danger, call <strong>{EMERGENCY_NUMBER}</strong> first.
        </p>
      </div>

      <p>
        These services are free, confidential, and independent of Digiability. You do not need an
        account with us to use any of them.
      </p>

      <h2 style={styles.h2}>Helplines in India</h2>

      <ul style={styles.list}>
        {sorted.map((r) => (
          <li
            key={r.phone}
            style={{
              ...styles.card,
              borderColor: r.priority === 'emergency' ? '#FEB2B2' : '#E5E0EB',
            }}
          >
            <div style={styles.cardHead}>
              <h3 style={styles.cardTitle}>{r.name}</h3>
              <span style={styles.pill}>{r.availability}</span>
            </div>
            <p style={styles.cardBody}>{r.description}</p>
            {r.languages && <p style={styles.languages}>{r.languages}</p>}
            <a
              href={`tel:${r.phone}`}
              style={{
                ...styles.callBtn,
                background: r.priority === 'emergency' ? '#E53E3E' : '#7004DC',
              }}
              aria-label={`Call ${r.name} on ${r.display}`}
            >
              <Phone size={16} aria-hidden="true" /> Call {r.display}
            </a>
          </li>
        ))}
      </ul>

      <h2 style={styles.h2}>Staying safe on Digiability</h2>

      <ul style={styles.plainList}>
        <li style={styles.tip}>
          <Flag size={17} color="#7004DC" aria-hidden="true" />
          <span>
            <strong>Report</strong> anything that breaks our{' '}
            <Link to="/community-guidelines" style={styles.link}>
              Community Guidelines
            </Link>
            . Every post, comment, profile and message has a Report option, and you&apos;ll get a
            reference number.
          </span>
        </li>
        <li style={styles.tip}>
          <Ban size={17} color="#7004DC" aria-hidden="true" />
          <span>
            <strong>Block</strong> anyone you&apos;d rather not hear from. Neither of you will be
            able to message the other, they aren&apos;t told, and you can undo it at any time.
          </span>
        </li>
        <li style={styles.tip}>
          <ShieldAlert size={17} color="#7004DC" aria-hidden="true" />
          <span>
            <strong>Child safety concerns</strong> go to a priority queue — see our{' '}
            <Link to="/child-safety" style={styles.link}>
              Child Safety Standards
            </Link>
            . If a child is at immediate risk, contact emergency services first.
          </span>
        </li>
      </ul>

      <p style={styles.footnote}>
        Nothing on Digiability is medical advice. Peer experience is not a substitute for a
        qualified professional.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.7,
  },
  h1: { fontSize: '1.8rem', marginBottom: '1rem' },
  h2: { fontSize: '1.2rem', marginTop: '2.5rem' },
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: '#FFF5F5',
    border: '1px solid #FEB2B2',
    borderRadius: 12,
    padding: '0.9rem 1rem',
    color: '#742A2A',
    marginBottom: '1.5rem',
  },
  list: { listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' },
  plainList: { listStyle: 'none', padding: 0, display: 'grid', gap: '1rem' },
  card: { border: '1px solid #E5E0EB', borderRadius: 14, padding: '1.1rem' },
  cardHead: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  cardTitle: { margin: 0, fontSize: '1.05rem', flex: 1 },
  pill: {
    fontSize: '0.75rem',
    fontWeight: 700,
    background: '#F3EAFF',
    color: '#5c03b4',
    padding: '0.2rem 0.6rem',
    borderRadius: 20,
  },
  cardBody: { margin: '0.5rem 0 0' },
  languages: { margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#7D7387' },
  callBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '0.9rem',
    padding: '0.6rem 1.1rem',
    borderRadius: 10,
    color: '#fff',
    fontWeight: 700,
    textDecoration: 'none',
  },
  tip: { display: 'flex', gap: '0.7rem', alignItems: 'flex-start' },
  link: { color: '#7004DC', fontWeight: 600 },
  footnote: { marginTop: '2.5rem', fontSize: '0.9rem', color: '#7D7387' },
};

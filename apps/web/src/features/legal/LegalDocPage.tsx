import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getLegalDocBySlug, ALL_LEGAL_DOCS } from '../../legal/legal-docs.generated';

// ─────────────────────────────────────────────────────────────
// Public legal document viewer.
//
// Renders whichever document docs/legal/manifest.json declares, from the
// markdown baked into legal-docs.generated.ts by `npm run sync:legal` (which
// also runs as apps/web's prebuild step).
//
// This replaces PrivacyPolicy.tsx and TermsOfService.tsx, which were
// hand-written JSX duplicating the mobile app's own hand-written copies. The
// two had already drifted apart — one source of truth now.
// ─────────────────────────────────────────────────────────────

export default function LegalDocPage({ slug: fixedSlug }: { slug?: string }) {
  const params = useParams();
  const slug = fixedSlug ?? params.slug ?? '';
  const doc = getLegalDocBySlug(slug);

  if (!doc) {
    return (
      <main style={styles.main}>
        <h1>Document not found</h1>
        <p>
          Available documents:{' '}
          {ALL_LEGAL_DOCS.map((d) => (
            <a key={d.slug} href={`/${d.slug}`} style={styles.link}>
              {d.title}{' '}
            </a>
          ))}
        </p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <article className="legal-doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.markdown}</ReactMarkdown>
      </article>

      <nav style={styles.nav} aria-label="Other legal documents">
        {ALL_LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
          <a key={d.slug} href={`/${d.slug}`} style={styles.link}>
            {d.title}
          </a>
        ))}
      </nav>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 800,
    margin: '0 auto',
    padding: '2rem 1rem 4rem',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.7,
  },
  nav: {
    marginTop: '3rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e5e5e5',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1.25rem',
  },
  link: { color: '#7004DC', fontWeight: 600 },
};

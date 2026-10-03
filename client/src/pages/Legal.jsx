import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useSettings } from '../SettingsContext.jsx';

/**
 * Plain text from the admin panel: a blank line starts a paragraph, "## " a
 * heading and "- " a list item. Rendered as React elements, never as HTML.
 */
function Blocks({ text }) {
  return text
    .split(/\n{2,}/)
    .map((block, i) => {
      const lines = block.split('\n');
      if (block.startsWith('## ')) {
        return <h2 key={i}>{block.slice(3).trim()}</h2>;
      }
      if (lines.every((l) => l.startsWith('- '))) {
        return (
          <ul key={i}>
            {lines.map((l, j) => (
              <li key={j}>{l.slice(2)}</li>
            ))}
          </ul>
        );
      }
      return (
        <p key={i}>
          {lines.map((l, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {l}
            </span>
          ))}
        </p>
      );
    });
}

export default function Legal() {
  const { page } = useParams();
  const { legalPages } = useSettings();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDoc(null);
    setError('');
    api(`/legal/${encodeURIComponent(page)}`)
      .then(setDoc)
      .catch((err) => setError(err.message));
  }, [page]);

  return (
    <section className="container page legal-page">
      <nav className="legal-tabs" aria-label="Legal pages">
        {legalPages.map((p) => (
          <Link key={p.id} to={`/legal/${p.id}`} className={p.id === page ? 'is-on' : ''}>
            {p.title}
          </Link>
        ))}
      </nav>
      {error && <p className="alert alert-error">{error}</p>}
      {!doc && !error && <div className="skeleton-grid"><div /></div>}
      {doc && (
        <article className="card legal-body">
          <h1>{doc.title}</h1>
          <Blocks text={doc.body} />
        </article>
      )}
    </section>
  );
}

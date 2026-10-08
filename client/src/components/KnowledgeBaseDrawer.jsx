/**
 * Reusable Knowledge Base drawer (feature 2).
 * Self-contained: drop <KnowledgeBaseDrawer /> on any page. It renders a floating
 * button and an Offcanvas with search + inline article view, and opens on Ctrl+K
 * (Cmd+K on Mac). Handy to keep open during a call in the simulator.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Offcanvas, Spinner } from 'react-bootstrap';
import ArticleBody from './ArticleBody';
import { kbApi } from '../api/services';
import { getErrorMessage } from '../utils/helpers';

export default function KnowledgeBaseDrawer() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState(null); // inline article view
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Ctrl/Cmd+K toggles the drawer.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runSearch = useCallback((q) => {
    setLoading(true);
    kbApi
      .list({ search: q, limit: 8 })
      .then((res) => setResults(res.data))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  // Load initial results when first opened; debounce typing.
  useEffect(() => {
    if (!open) return undefined;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, open, runSearch]);

  const openArticle = async (slug) => {
    setLoading(true);
    setError('');
    try {
      const res = await kbApi.get(slug);
      setArticle(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setArticle(null);
  };

  return (
    <>
      <button type="button" className="kb-fab no-print" onClick={() => setOpen(true)} title="Knowledge Base (Ctrl+K)">
        <i className="bi bi-journal-richtext" />
        <span className="d-none d-sm-inline ms-1">KB</span>
      </button>

      <Offcanvas show={open} onHide={close} placement="end" className="kb-drawer">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="h6 mb-0">
            {article ? (
              <button type="button" className="btn btn-link p-0 text-decoration-none" onClick={() => setArticle(null)}>
                <i className="bi bi-arrow-left me-1" /> Back to search
              </button>
            ) : (
              <>Knowledge Base <span className="text-muted small">(Ctrl+K)</span></>
            )}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {article ? (
            <div>
              <h2 className="h5">{article.title}</h2>
              <div className="small text-muted mb-2">{article.category}{article.account ? ` · ${article.account}` : ''}</div>
              <ArticleBody text={article.body} />
              {article.relatedCourses?.length > 0 && (
                <div className="mt-3">
                  <div className="small fw-semibold mb-1">Related courses</div>
                  {article.relatedCourses.map((c) => (
                    <Link key={c._id} to={`/agent/courses/${c._id}`} className="d-block small" onClick={close}>
                      {c.code} · {c.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <Form.Control autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search articles..." className="mb-3" />
              {error && <div className="small text-danger mb-2">{error}</div>}
              {loading ? (
                <div className="text-center py-4"><Spinner size="sm" /></div>
              ) : results.length === 0 ? (
                <p className="text-muted small">No articles found.</p>
              ) : (
                <div className="kb-drawer-list">
                  {results.map((a) => (
                    <button key={a._id} type="button" className="kb-drawer-item" onClick={() => openArticle(a.slug)}>
                      <span className="fw-semibold d-block">{a.title}</span>
                      <span className="small text-muted d-block">{a.summary}</span>
                      <span className="badge-tone badge-blue mt-1 d-inline-block">{a.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

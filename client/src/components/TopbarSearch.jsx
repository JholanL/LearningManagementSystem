import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchesApi, coursesApi, kbApi, scenariosApi } from '../api/services';
import { getErrorMessage } from '../utils/helpers';

// Topbar search for agents and trainers (admins use AdminGlobalSearch).
// Each role searches a few list endpoints in parallel; the API already limits what each role can see.
// Reuses the AdminGlobalSearch styles (.admin-global-search-*).

const PER_GROUP = 4;
const status = (published) => (published ? 'Published' : 'Draft');

const GROUPS_BY_ROLE = {
  agent: [
    {
      key: 'courses',
      label: 'My Courses',
      icon: 'bi-journal-bookmark',
      fetch: (params) => coursesApi.list(params),
      subtitle: (c) => [c.code, c.category, c.progress && `${c.progress.percent}% complete`],
      path: (c) => `/agent/courses/${c._id}`,
    },
    {
      key: 'articles',
      label: 'Knowledge Base',
      icon: 'bi-book',
      fetch: (params) => kbApi.list(params),
      subtitle: (a) => [a.category, a.summary],
      path: (a) => `/agent/kb/${encodeURIComponent(a.slug)}`,
    },
    {
      key: 'scenarios',
      label: 'Call Simulator',
      icon: 'bi-headset',
      fetch: (params) => scenariosApi.list(params),
      subtitle: (s) => [s.category, s.difficulty, s.bestScore != null ? `Best ${s.bestScore}%` : 'Not attempted'],
      path: (s) => `/agent/simulator/${s._id}`,
    },
  ],
  trainer: [
    {
      key: 'courses',
      label: 'My Courses',
      icon: 'bi-journal-bookmark',
      fetch: (params) => coursesApi.list({ ...params, mine: true }),
      subtitle: (c) => [c.code, c.category, status(c.isPublished)],
      path: (c) => `/trainer/courses/${c._id}`,
    },
    {
      key: 'batches',
      label: 'My Batches',
      icon: 'bi-collection',
      fetch: (params) => batchesApi.list(params),
      subtitle: (b) => [b.account, b.status],
      path: (b) => `/trainer/batches/${b._id}`,
    },
    {
      key: 'scenarios',
      label: 'Scenarios',
      icon: 'bi-headset',
      fetch: (params) => scenariosApi.list(params),
      subtitle: (s) => [s.category, s.difficulty, status(s.isPublished)],
      path: (s) => `/trainer/scenarios/${s._id}`,
    },
    {
      key: 'articles',
      label: 'Knowledge Base',
      icon: 'bi-book',
      fetch: (params) => kbApi.list(params),
      subtitle: (a) => [a.category, a.status === 'published' ? 'Published' : 'Draft'],
      path: (a) => `/trainer/kb?search=${encodeURIComponent(a.title)}`,
    },
  ],
};

const emptyResults = (groups) => Object.fromEntries(groups.map((g) => [g.key, []]));
const normalize = (value) => value.trim().replace(/\s+/g, ' ');

export default function TopbarSearch({ role }) {
  const GROUPS = useMemo(() => GROUPS_BY_ROLE[role] || [], [role]);
  const EMPTY_RESULTS = useMemo(() => emptyResults(GROUPS), [GROUPS]);
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(() => emptyResults(GROUPS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedQuery = normalize(query);
  const flatResults = useMemo(
    () => GROUPS.flatMap(({ key }) => (results[key] || []).map((item) => ({ group: key, item }))),
    [GROUPS, results],
  );

  // Debounced search across the three agent lists (in parallel)
  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const requestId = ++requestIdRef.current;

      if (normalizedQuery.length < 2) {
        setResults(EMPTY_RESULTS);
        setLoading(false);
        setError('');
        setActiveIndex(-1);
        return;
      }

      setLoading(true);
      setError('');
      setOpen(true);

      try {
        const params = { search: normalizedQuery, limit: PER_GROUP };
        const responses = await Promise.all(GROUPS.map((g) => g.fetch(params)));
        if (requestId !== requestIdRef.current) return;
        setResults(Object.fromEntries(GROUPS.map((g, i) => [g.key, responses[i]?.data || []])));
        setActiveIndex(-1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        setResults(EMPTY_RESULTS);
        setError(getErrorMessage(err, 'Could not search. Please try again.'));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery, GROUPS, EMPTY_RESULTS]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const clearSearch = () => {
    requestIdRef.current += 1; // ignore any search still in flight
    setQuery('');
    setResults(EMPTY_RESULTS);
    setError('');
    setLoading(false);
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  };

  const selectResult = (group, item) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    inputRef.current?.blur();
    navigate(GROUPS.find((g) => g.key === group).path(item));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!flatResults.length || !open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flatResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? flatResults.length - 1 : current - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = flatResults[activeIndex >= 0 ? activeIndex : 0];
      selectResult(selected.group, selected.item);
    }
  };

  const hasQuery = normalizedQuery.length > 0;
  const showMenu = open && (hasQuery || loading || error);

  return (
    <div className="topbar-search admin-global-search position-relative d-none d-md-block" ref={containerRef}>
      <i className="bi bi-search" aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        className="form-control"
        placeholder={role === 'trainer' ? 'Search courses, batches, scenarios...' : 'Search courses, articles, calls...'}
        aria-label="Search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="topbar-search-list"
        aria-expanded={Boolean(showMenu)}
        aria-activedescendant={activeIndex >= 0 ? `topbar-search-result-${activeIndex}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {query && (
        <button type="button" className="admin-search-clear" aria-label="Clear search" onClick={clearSearch}>
          <i className="bi bi-x" aria-hidden="true" />
        </button>
      )}

      {showMenu && (
        <div id="topbar-search-list" className="admin-global-search-menu" role="listbox" aria-label="Search results">
          {loading && (
            <div className="admin-search-message" role="status">
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" /> Searching...
            </div>
          )}
          {!loading && error && <div className="admin-search-message text-danger" role="alert">{error}</div>}
          {!loading && !error && normalizedQuery.length === 1 && (
            <div className="admin-search-message">Type at least 2 characters to search.</div>
          )}
          {!loading && !error && normalizedQuery.length >= 2 && flatResults.length === 0 && (
            <div className="admin-search-message">Nothing matches “{normalizedQuery}”.</div>
          )}
          {!loading && !error && normalizedQuery.length >= 2 && flatResults.length > 0 && GROUPS.map((group) => {
            const items = results[group.key] || [];
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div className="admin-search-group-title"><i className={`bi ${group.icon} me-2`} />{group.label}</div>
                {items.map((item) => {
                  const index = flatResults.findIndex((entry) => entry.group === group.key && entry.item._id === item._id);
                  return (
                    <button
                      key={`${group.key}-${item._id}`}
                      id={`topbar-search-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`admin-search-item ${index === activeIndex ? 'is-active' : ''}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectResult(group.key, item)}
                    >
                      <span className="admin-search-item-icon"><i className={`bi ${group.icon}`} /></span>
                      <span className="min-w-0">
                        <span className="admin-search-item-title d-block text-truncate">{item.title}</span>
                        <span className="admin-search-item-subtitle d-block text-truncate">{group.subtitle(item).filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

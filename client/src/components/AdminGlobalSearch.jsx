import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminSearchApi } from '../api/services';
import { formatDate, getErrorMessage } from '../utils/helpers';

const EMPTY_RESULTS = { users: [], batches: [], certificates: [] };

const GROUPS = [
  { key: 'users', label: 'Users', icon: 'bi-people' },
  { key: 'batches', label: 'Batches', icon: 'bi-collection' },
  { key: 'certificates', label: 'Certificates', icon: 'bi-award' },
];

const normalize = (value) => value.trim().replace(/\s+/g, ' ');

function resultTitle(group, item) {
  if (group === 'users') return item.name;
  if (group === 'batches') return item.name;
  return item.code;
}

function resultSubtitle(group, item) {
  if (group === 'users') return [item.email, item.employeeId, item.role].filter(Boolean).join(' · ');
  if (group === 'batches') return [item.account, item.status].filter(Boolean).join(' · ');
  return [item.agent?.name, item.course?.title, item.issuedAt ? `Issued ${formatDate(item.issuedAt)}` : ''].filter(Boolean).join(' · ');
}

function resultPath(group, item) {
  if (group === 'users') return `/admin/users?search=${encodeURIComponent(item.email || item.employeeId || item.name)}`;
  if (group === 'batches') return `/admin/batches/${item.id}`;
  return `/admin/certificates?search=${encodeURIComponent(item.code)}`;
}

export default function AdminGlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedQuery = normalize(query);
  const flatResults = useMemo(
    () => GROUPS.flatMap(({ key }) => (results[key] || []).map((item) => ({ group: key, item }))),
    [results],
  );

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const requestId = ++requestIdRef.current;

      if (normalizedQuery.length < 2) {
        setResults(EMPTY_RESULTS);
        setLoading(false);
        setError('');
        setActiveIndex(-1);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError('');
      setOpen(true);

      try {
        const response = await adminSearchApi.search(normalizedQuery, { signal: controller.signal });
        if (requestId !== requestIdRef.current) return;
        setResults(response?.data || EMPTY_RESULTS);
        setActiveIndex(-1);
      } catch (err) {
        if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return;
        if (requestId !== requestIdRef.current) return;
        setResults(EMPTY_RESULTS);
        setError(getErrorMessage(err, 'Could not search records. Please try again.'));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [normalizedQuery]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const clearSearch = () => {
    abortRef.current?.abort();
    setQuery('');
    setResults(EMPTY_RESULTS);
    setError('');
    setActiveIndex(-1);
    setOpen(false);
    inputRef.current?.focus();
  };

  const selectResult = (group, item) => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    navigate(resultPath(group, item));
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
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const selected = flatResults[activeIndex];
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
        placeholder="Search..."
        aria-label="Search Admin records"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="admin-global-search-list"
        aria-expanded={showMenu}
        aria-activedescendant={activeIndex >= 0 ? `admin-search-result-${activeIndex}` : undefined}
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
        <div id="admin-global-search-list" className="admin-global-search-menu" role="listbox" aria-label="Search results">
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
            <div className="admin-search-message">No matching records found.</div>
          )}
          {!loading && !error && normalizedQuery.length >= 2 && flatResults.length > 0 && GROUPS.map((group) => {
            const items = results[group.key] || [];
            if (!items.length) return null;
            return (
              <div key={group.key}>
                <div className="admin-search-group-title"><i className={`bi ${group.icon} me-2`} />{group.label}</div>
                {items.map((item) => {
                  const index = flatResults.findIndex((entry) => entry.group === group.key && entry.item.id === item.id);
                  return (
                    <button
                      key={`${group.key}-${item.id}`}
                      id={`admin-search-result-${index}`}
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
                        <span className="admin-search-item-title d-block text-truncate">{resultTitle(group.key, item)}</span>
                        <span className="admin-search-item-subtitle d-block text-truncate">{resultSubtitle(group.key, item)}</span>
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

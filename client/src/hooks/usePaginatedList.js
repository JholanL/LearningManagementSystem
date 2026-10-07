import { useCallback, useEffect, useState } from 'react';
import useDebounce from './useDebounce';
import { getErrorMessage } from '../utils/helpers';

/**
 * Reusable state for any "list page" with search + filters + pagination.
 *
 *   const list = usePaginatedList(usersApi.list, { role: '' });
 *   list.items, list.pagination, list.loading, list.error
 *   list.search / list.setSearch       (debounced automatically)
 *   list.filters / list.setFilter('role', 'agent')
 *   list.setPage(2), list.reload()
 */
export default function usePaginatedList(fetcher, initialFilters = {}, { limit = 10 } = {}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit });
  const [page, setPage] = useState(1);
  const [search, setSearchState] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebounce(search, 400);

  useEffect(() => {
    let ignore = false; // prevents setting state from an outdated request
    setLoading(true);
    setError('');
    fetcher({ page, limit, search: debouncedSearch, ...filters })
      .then((res) => {
        if (ignore) return;
        setItems(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, debouncedSearch, JSON.stringify(filters), reloadKey]);

  const setSearch = (value) => {
    setSearchState(value);
    setPage(1);
  };

  const setFilter = (key, value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return { items, pagination, page, setPage, search, setSearch, filters, setFilter, loading, error, reload };
}

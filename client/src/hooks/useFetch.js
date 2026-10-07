import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../utils/helpers';

/**
 * Loads data once (and again when deps change).
 *   const { data, loading, error, reload } = useFetch(() => dashboardApi.agent(), []);
 *   data = the full response body, e.g. data.data
 */
export default function useFetch(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    fetcher()
      .then((res) => !ignore && setData(res))
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  return { data, loading, error, reload };
}

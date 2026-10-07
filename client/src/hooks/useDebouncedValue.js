import { useEffect, useState } from 'react';

// Returns `value` only after it stops changing for `delay` ms.
// Used for search boxes so the API is not called on every key press.
export default function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { TOKEN_KEY } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while checking a saved token on page load
  const [sessionMessage, setSessionMessage] = useState('');

  const clearSession = useCallback((message = '') => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setSessionMessage(message);
  }, []);

  // On first load: if a token is saved, fetch the current user
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, [clearSession]);

  // Axios interceptor fires this when the server says the token is no longer valid
  useEffect(() => {
    const onExpired = (e) => clearSession(e.detail || 'Your session has ended. Please log in again.');
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [clearSession]);

  const saveSession = (res) => {
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    setSessionMessage('');
    return res.user;
  };

  const login = async (email, password) => saveSession(await authApi.login({ email, password }));
  const register = async (data) => saveSession(await authApi.register(data));

  const logout = async () => {
    try {
      await authApi.logout(); // invalidates the token on the server too
    } catch {
      /* ignore - we clear locally anyway */
    }
    clearSession();
  };

  const refreshUser = async () => {
    const res = await authApi.me();
    setUser(res.user);
    return res.user;
  };

  // After a password change the server issues a new token
  const replaceToken = (token) => localStorage.setItem(TOKEN_KEY, token);

  const value = useMemo(
    () => ({ user, setUser, loading, sessionMessage, login, register, logout, refreshUser, replaceToken }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, sessionMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

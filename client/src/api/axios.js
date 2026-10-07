import axios from 'axios';

export const TOKEN_KEY = 'vla_token';

// One shared Axios instance for the whole app.
// VITE_API_URL comes from client/.env (see .env.example)
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
});

// Attach the JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is expired/invalid, tell the AuthContext to log out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    if (status === 401 && !isAuthAttempt && localStorage.getItem(TOKEN_KEY)) {
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: error.response?.data?.message }));
    }
    return Promise.reject(error);
  }
);

export default api;

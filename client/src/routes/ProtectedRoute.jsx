import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { ROLE_HOME } from '../utils/helpers';

/**
 * Guards a group of routes.
 *   <Route element={<ProtectedRoute roles={['admin']} />}> ...admin pages... </Route>
 * - Not logged in  -> /login (remembers where the user wanted to go)
 * - Wrong role     -> /unauthorized
 * NOTE: this only hides pages. The real security is the backend's protect/authorize middleware.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}

// For login/register: logged-in users are sent to their dashboard
export function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (user) return <Navigate to={ROLE_HOME[user.role]} replace />;
  return <Outlet />;
}

// "/" -> the right home page
export function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

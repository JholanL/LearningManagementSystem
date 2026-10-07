import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageSpinner from './PageSpinner';

// Log in and register are only for signed-out visitors.
export default function GuestRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;

  if (user) {
    // Go back to the page that sent the visitor to log in, if there was one.
    return <Navigate to={location.state?.from?.pathname || '/dashboard'} replace />;
  }

  return <Outlet />;
}

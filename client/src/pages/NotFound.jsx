import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center text-center p-4">
      <h1 className="font-display display-4">Page not found</h1>
      <p className="text-body-secondary mb-4">The page you opened does not exist or was moved.</p>
      <Link to="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}

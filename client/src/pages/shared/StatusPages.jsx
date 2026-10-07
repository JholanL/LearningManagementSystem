import { Link } from 'react-router-dom';
import { Button } from 'react-bootstrap';

function StatusPage({ code, icon, title, message }) {
  return (
    <div className="status-page d-flex flex-column align-items-center justify-content-center text-center px-3">
      <div className="status-code">{code}</div>
      <i className={`bi ${icon} display-5 text-primary mb-3`} />
      <h1 className="h4 fw-bold">{title}</h1>
      <p className="text-muted mb-4">{message}</p>
      <Button as={Link} to="/">
        <i className="bi bi-house me-2" />
        Back to home
      </Button>
    </div>
  );
}

export const NotFound = () => (
  <StatusPage code="404" icon="bi-signpost-split" title="Page not found" message="The page you're looking for doesn't exist or was moved." />
);

export const Unauthorized = () => (
  <StatusPage code="403" icon="bi-shield-lock" title="Access denied" message="Your account doesn't have permission to view this page." />
);

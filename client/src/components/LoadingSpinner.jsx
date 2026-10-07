import { Spinner } from 'react-bootstrap';

export default function LoadingSpinner({ fullPage = false, text = 'Loading...' }) {
  return (
    <div className={`d-flex flex-column align-items-center justify-content-center gap-2 text-muted ${fullPage ? 'vh-100' : 'py-5'}`}>
      <Spinner animation="border" variant="primary" role="status" />
      <small>{text}</small>
    </div>
  );
}

import Spinner from 'react-bootstrap/Spinner';

export default function PageSpinner() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">Loading</span>
      </Spinner>
    </div>
  );
}

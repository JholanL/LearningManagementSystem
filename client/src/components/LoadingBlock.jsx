import Spinner from 'react-bootstrap/Spinner';

// Spinner for a section of a page (PageSpinner covers the whole screen).
export default function LoadingBlock() {
  return (
    <div className="d-flex justify-content-center py-5">
      <Spinner animation="border" variant="primary" role="status">
        <span className="visually-hidden">Loading</span>
      </Spinner>
    </div>
  );
}

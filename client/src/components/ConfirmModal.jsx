import { Button, Modal, Spinner } from 'react-bootstrap';

// Reusable "Are you sure?" dialog for deletes and other destructive actions
export default function ConfirmModal({
  show,
  title = 'Are you sure?',
  message,
  confirmText = 'Delete',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal show={show} onHide={loading ? undefined : onCancel} centered>
      <Modal.Header closeButton={!loading}>
        <Modal.Title className="h5">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{message}</Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading && <Spinner size="sm" className="me-2" />}
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

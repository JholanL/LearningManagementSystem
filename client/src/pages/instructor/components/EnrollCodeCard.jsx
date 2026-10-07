import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import ConfirmModal from '../../../components/ConfirmModal';

// Shows the code students type to join, with copy and replace actions.
export default function EnrollCodeCard({ code, isPublished, onRegenerate }) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lms-card lms-code-card d-flex flex-wrap align-items-center gap-3 p-3 p-md-4">
      <div className="me-auto">
        <div className="small fw-semibold" style={{ color: 'var(--lms-deep)' }}>
          Enroll code
        </div>
        <div className="lms-code" aria-live="polite">
          {code || '——————'}
        </div>
        <div className="small" style={{ color: '#2c4a3b' }}>
          {isPublished
            ? 'Share this with your students so they can join.'
            : 'Students can join with this code once you publish the course.'}
        </div>
      </div>
      <div className="d-flex gap-2">
        <Button variant="primary" onClick={handleCopy} disabled={!code}>
          <i className={`bi ${copied ? 'bi-check2' : 'bi-copy'} me-2`} aria-hidden="true" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="outline-primary" onClick={() => setConfirming(true)}>
          New code
        </Button>
      </div>

      <ConfirmModal
        show={confirming}
        title="Replace the enroll code?"
        confirmLabel="Replace code"
        variant="primary"
        onConfirm={onRegenerate}
        onHide={() => setConfirming(false)}
      >
        <p className="mb-0">
          The current code stops working right away. Students who already joined stay enrolled.
        </p>
      </ConfirmModal>
    </div>
  );
}

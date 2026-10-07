import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Form, InputGroup, Spinner } from 'react-bootstrap';
import { certificatesApi } from '../../api/services';
import { formatDate, getErrorMessage } from '../../utils/helpers';

// PUBLIC page: anyone (e.g. an employer) can check if a certificate code is real.  /verify/VLA-2026-ABC123
export default function VerifyCertificate() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeParam || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!codeParam) return;
    setLoading(true);
    setError('');
    setResult(null);
    certificatesApi
      .verify(codeParam)
      .then((res) => setResult(res.data))
      .catch((err) => setError(getErrorMessage(err, 'Certificate not found.')))
      .finally(() => setLoading(false));
  }, [codeParam]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (code.trim()) navigate(`/verify/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="verify-page d-flex align-items-center justify-content-center px-3 py-5">
      <div className="w-100" style={{ maxWidth: 520 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-4">
          <span className="brand-mark">
            <i className="bi bi-headset" />
          </span>
          <span className="fw-bold text-body">VoiceLink Academy</span>
        </Link>
        <Card>
          <Card.Body className="p-4">
            <h1 className="h4 fw-bold mb-1">Verify a certificate</h1>
            <p className="text-muted small mb-4">Enter the code printed on the certificate, e.g. VLA-2026-7F3K9Q.</p>
            <Form onSubmit={onSubmit}>
              <InputGroup>
                <Form.Control value={code} onChange={(e) => setCode(e.target.value)} placeholder="VLA-2026-XXXXXX" maxLength={20} aria-label="Certificate code" />
                <Button type="submit" disabled={loading}>
                  {loading ? <Spinner size="sm" /> : 'Verify'}
                </Button>
              </InputGroup>
            </Form>

            {error && (
              <Alert variant="danger" className="mt-4 mb-0 d-flex gap-2">
                <i className="bi bi-x-octagon-fill" /> {error}
              </Alert>
            )}
            {result && (
              <div className="verify-result mt-4">
                <div className="d-flex align-items-center gap-2 text-success fw-semibold mb-3">
                  <i className="bi bi-patch-check-fill fs-4" /> Valid certificate
                </div>
                <dl className="row small mb-0">
                  <dt className="col-4">Holder</dt>
                  <dd className="col-8">{result.holder}</dd>
                  <dt className="col-4">Course</dt>
                  <dd className="col-8">{result.course}</dd>
                  <dt className="col-4">Final score</dt>
                  <dd className="col-8">{result.finalScore}%</dd>
                  <dt className="col-4">Issued</dt>
                  <dd className="col-8">{formatDate(result.issuedAt)}</dd>
                  <dt className="col-4">Code</dt>
                  <dd className="col-8">
                    <code>{result.code}</code>
                  </dd>
                </dl>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
    </div>
  );
}

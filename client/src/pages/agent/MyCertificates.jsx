/**
 * Agent → My Certificates (feature 4).
 * Cards with Download PDF (jsPDF + QR) and Copy verify link.
 */
import { useState } from 'react';
import { Badge, Button, Card, Col, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { certificatesApi } from '../../api/services';
import { formatDate, getErrorMessage } from '../../utils/helpers';
import { generateCertificatePdf } from '../../utils/certificatePdf';

export default function MyCertificates() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => certificatesApi.mine(), []);
  const [busy, setBusy] = useState(null); // code currently generating a PDF

  const certs = data?.data || [];
  const holder = data?.holder;
  const trainer = data?.trainer;

  const verifyUrl = (code) => `${window.location.origin}/verify/${code}`;

  const download = async (c) => {
    setBusy(c.code);
    try {
      await generateCertificatePdf({
        holder,
        course: `${c.course.code} — ${c.course.title}`,
        code: c.code,
        finalScore: c.finalScore,
        issuedAt: c.issuedAt,
        trainer,
        verifyUrl: verifyUrl(c.code),
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not generate the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (c) => {
    try {
      await navigator.clipboard.writeText(verifyUrl(c.code));
      toast.success('Verification link copied.');
    } catch {
      toast.error('Could not copy. Link: ' + verifyUrl(c.code));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load certificates" message={error} action={<Button onClick={reload}>Retry</Button>} />;

  return (
    <>
      <PageHeader title="My Certificates" icon="bi-award" subtitle="Download a PDF or share a verification link for each completed course." />

      {certs.length === 0 ? (
        <EmptyState icon="bi-award" title="No certificates yet" message="Complete every lesson and pass every quiz in a course to earn a certificate." />
      ) : (
        <Row className="g-3">
          {certs.map((c) => (
            <Col md={6} lg={4} key={c._id}>
              <Card className="h-100 cert-card">
                <Card.Body className="d-flex flex-column">
                  <div className="cert-ribbon"><i className="bi bi-award-fill" /></div>
                  <Badge bg="light" text="dark" className="align-self-start mb-2">{c.course?.code}</Badge>
                  <h2 className="h6 fw-semibold">{c.course?.title}</h2>
                  <div className="small text-muted mb-1">Final score: <strong>{c.finalScore}%</strong></div>
                  <div className="small text-muted mb-1">Issued {formatDate(c.issuedAt)}</div>
                  <div className="small text-muted mb-3"><code>{c.code}</code></div>
                  <div className="mt-auto d-flex gap-2">
                    <Button size="sm" onClick={() => download(c)} disabled={busy === c.code}>
                      <i className="bi bi-download me-1" />{busy === c.code ? 'Generating…' : 'Download PDF'}
                    </Button>
                    <Button size="sm" variant="light" onClick={() => copyLink(c)}>
                      <i className="bi bi-link-45deg me-1" />Copy link
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

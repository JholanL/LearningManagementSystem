import { useEffect, useState } from 'react';
import { Button, Card, Col, Modal, Row, Table } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { certificatesApi } from '../../api/services';
import { formatDate } from '../../utils/helpers';

const fullName = (user) => (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' : '—');
const courseName = (course) => (course ? `${course.code ? `${course.code} — ` : ''}${course.title || ''}`.trim() || '—' : '—');
const scoreLabel = (score) => (typeof score === 'number' ? `${score}%` : '—');

function verifyPath(code) {
  return code ? `/verify/${encodeURIComponent(code)}` : '/verify';
}

export default function ManageCertificates() {
  const list = usePaginatedList(certificatesApi.list);
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (initialSearch) list.setSearch(initialSearch);
    // Apply a global-search deep link once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch]);

  return (
    <>
      <PageHeader
        title="Certificate Management"
        icon="bi-award"
        subtitle="View certificates issued to agents and inspect their verification details."
      />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={8} lg={6}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by agent name or certificate code..." />
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState
              icon="bi-exclamation-triangle"
              title="Could not load certificates"
              message={list.error}
              action={<Button onClick={list.reload}>Retry</Button>}
            />
          ) : list.items.length === 0 ? (
            <EmptyState
              icon="bi-award"
              title={list.search ? 'No certificates found' : 'No certificates issued'}
              message={list.search ? 'Try a different agent name or certificate code.' : 'Issued certificates will appear here.'}
            />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Certificate Code</th>
                    <th>Agent</th>
                    <th>Course</th>
                    <th>Final Score</th>
                    <th>Date Issued</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((certificate) => (
                    <tr key={certificate._id}>
                      <td><code>{certificate.code || '—'}</code></td>
                      <td>
                        <div className="fw-semibold">{fullName(certificate.user)}</div>
                        {certificate.user?.employeeId && <div className="small text-muted">{certificate.user.employeeId}</div>}
                      </td>
                      <td>{courseName(certificate.course)}</td>
                      <td>{scoreLabel(certificate.finalScore)}</td>
                      <td className="text-nowrap">{formatDate(certificate.issuedAt)}</td>
                      <td>
                        <div className="d-flex flex-wrap justify-content-end gap-2">
                          <Button variant="outline-primary" size="sm" onClick={() => setSelected(certificate)}>
                            <i className="bi bi-eye me-1" /> View details
                          </Button>
                          <Button
                            as="a"
                            href={verifyPath(certificate.code)}
                            target="_blank"
                            rel="noreferrer"
                            variant="light"
                            size="sm"
                            disabled={!certificate.code}
                          >
                            <i className="bi bi-shield-check me-1" /> Verify
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
        </Card.Body>
      </Card>

      <Modal show={!!selected} onHide={() => setSelected(null)} centered>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Certificate details</Modal.Title>
            <p className="modal-subtitle mb-0">Issued certificate record</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <dl className="profile-meta mb-0">
              <Row>
                <Col sm={6}>
                  <dt>Certificate code</dt>
                  <dd><code>{selected.code || '—'}</code></dd>
                </Col>
                <Col sm={6}>
                  <dt>Date issued</dt>
                  <dd>{formatDate(selected.issuedAt)}</dd>
                </Col>
                <Col sm={6}>
                  <dt>Agent</dt>
                  <dd>{fullName(selected.user)}</dd>
                </Col>
                <Col sm={6}>
                  <dt>Employee ID</dt>
                  <dd>{selected.user?.employeeId || '—'}</dd>
                </Col>
                <Col xs={12}>
                  <dt>Course</dt>
                  <dd>{courseName(selected.course)}</dd>
                </Col>
                <Col sm={6}>
                  <dt>Final score</dt>
                  <dd>{scoreLabel(selected.finalScore)}</dd>
                </Col>
                <Col sm={6}>
                  <dt>Verification</dt>
                  <dd>
                    {selected.code ? (
                      <a href={verifyPath(selected.code)} target="_blank" rel="noreferrer">Open verification page</a>
                    ) : '—'}
                  </dd>
                </Col>
              </Row>
            </dl>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSelected(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

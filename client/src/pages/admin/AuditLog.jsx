/**
 * Admin → Audit Log (feature 8).
 * Read-only security log: who did what, when. Filters + details modal.
 * Pattern follows admin/ManageBatches.jsx.
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { auditApi } from '../../api/services';
import { formatDateTime } from '../../utils/helpers';

// Pick a badge tone from the action name.
function actionTone(action = '') {
  if (/failed|locked|delete/.test(action)) return 'badge-red';
  if (/create|publish|unlock/.test(action)) return 'badge-green';
  if (/login|logout|password/.test(action)) return 'badge-blue';
  return 'badge-gray';
}

const ROLE_TONE = { admin: 'badge-navy', trainer: 'badge-blue', agent: 'badge-gray', guest: 'badge-gray' };

export default function AuditLog() {
  const list = usePaginatedList(auditApi.list, { action: '', from: '', to: '' });

  const [actions, setActions] = useState([]);
  useEffect(() => {
    auditApi.actions().then((res) => setActions(res.data)).catch(() => {});
  }, []);

  const [selected, setSelected] = useState(null); // row for the details modal

  return (
    <>
      <PageHeader
        title="Audit Log"
        icon="bi-shield-check"
        subtitle="Security and accountability trail of key actions across the system."
      />

      <Card>
        <Card.Body>
          {/* Filters */}
          <Row className="g-2 mb-3">
            <Col md={4}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by actor, target or action..." />
            </Col>
            <Col sm={6} md={3}>
              <Form.Select value={list.filters.action} onChange={(e) => list.setFilter('action', e.target.value)} aria-label="Filter by action">
                <option value="">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6} md={2}>
              <Form.Control type="date" value={list.filters.from} onChange={(e) => list.setFilter('from', e.target.value)} aria-label="From date" title="From date" />
            </Col>
            <Col sm={6} md={2}>
              <Form.Control type="date" value={list.filters.to} onChange={(e) => list.setFilter('to', e.target.value)} aria-label="To date" title="To date" />
            </Col>
            <Col sm={6} md={1} className="d-grid">
              <Button variant="light" onClick={() => { list.setFilter('action', ''); list.setFilter('from', ''); list.setFilter('to', ''); list.setSearch(''); }} title="Clear filters">
                <i className="bi bi-x-circle" />
              </Button>
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load the audit log" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-shield-check" title="No audit entries" message="Try a different search, action or date range." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((log) => (
                    <tr key={log._id} role="button" onClick={() => setSelected(log)} title="View details">
                      <td className="small text-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td>
                        <div className="fw-semibold">{log.actorName}</div>
                        <span className={`badge-tone ${ROLE_TONE[log.actorRole] || 'badge-gray'}`}>{log.actorRole}</span>
                      </td>
                      <td><span className={`badge-tone ${actionTone(log.action)}`}>{log.action}</span></td>
                      <td className="small">
                        {log.targetLabel ? (
                          <>
                            <div>{log.targetLabel}</div>
                            {log.targetType && <div className="text-muted">{log.targetType}</div>}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="small text-muted">{log.ip || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
        </Card.Body>
      </Card>

      {/* Details modal */}
      <Modal show={!!selected} onHide={() => setSelected(null)} centered>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Audit entry</Modal.Title>
            {selected && <p className="modal-subtitle">{formatDateTime(selected.createdAt)}</p>}
          </div>
        </Modal.Header>
        <Modal.Body>
          {selected && (
            <dl className="profile-meta mb-0">
              <Row>
                <Col sm={6}>
                  <dt>Actor</dt>
                  <dd>{selected.actorName} <Badge bg="light" text="dark">{selected.actorRole}</Badge></dd>
                </Col>
                <Col sm={6}>
                  <dt>Action</dt>
                  <dd><span className={`badge-tone ${actionTone(selected.action)}`}>{selected.action}</span></dd>
                </Col>
                <Col sm={6}>
                  <dt>Target</dt>
                  <dd>{selected.targetLabel || '—'}{selected.targetType ? ` (${selected.targetType})` : ''}</dd>
                </Col>
                <Col sm={6}>
                  <dt>IP address</dt>
                  <dd>{selected.ip || '—'}</dd>
                </Col>
                <Col xs={12}>
                  <dt>User agent</dt>
                  <dd className="small text-break">{selected.userAgent || '—'}</dd>
                </Col>
                <Col xs={12}>
                  <dt>Metadata</dt>
                  <dd>
                    {selected.metadata && Object.keys(selected.metadata).length ? (
                      <pre className="audit-meta mb-0">{JSON.stringify(selected.metadata, null, 2)}</pre>
                    ) : (
                      <span className="text-muted">No extra data.</span>
                    )}
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

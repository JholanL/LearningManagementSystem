/**
 * Admin → Endorsements queue (feature 5).
 * Pending / Approved / Rejected tabs, with approve / reject / revoke actions.
 * A note is required when rejecting.
 */
import { useState } from 'react';
import { Button, Card, Form, Modal, Nav, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProductionBadge from '../../components/ProductionBadge';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { endorsementsApi } from '../../api/services';
import { fullName, formatDate, getErrorMessage } from '../../utils/helpers';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const ACTION = {
  approve: { title: 'Approve endorsement', verb: 'Approve', variant: 'primary', requireNote: false, help: 'The agent will move to Production.' },
  reject: { title: 'Reject endorsement', verb: 'Reject', variant: 'danger', requireNote: true, help: 'The agent stays In training. A reason is required.' },
  revoke: { title: 'Revoke endorsement', verb: 'Revoke', variant: 'danger', requireNote: false, help: 'Moves the agent back to In training.' },
};

export default function Endorsements() {
  const toast = useToast();
  const list = usePaginatedList(endorsementsApi.list, { status: 'pending' });
  const [decision, setDecision] = useState(null); // { endorsement, mode }
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const open = (endorsement, mode) => {
    setDecision({ endorsement, mode });
    setNote('');
    setErr('');
  };

  const confirm = async () => {
    const cfg = ACTION[decision.mode];
    if (cfg.requireNote && !note.trim()) {
      setErr('A reason is required.');
      return;
    }
    setSaving(true);
    try {
      await endorsementsApi[decision.mode](decision.endorsement._id, note);
      toast.success(`Endorsement ${decision.mode}d.`);
      setDecision(null);
      list.reload();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Endorsements" icon="bi-hand-thumbs-up" subtitle="Review trainer endorsements and move agents into production." />

      <Nav variant="tabs" activeKey={list.filters.status} onSelect={(k) => list.setFilter('status', k)} className="mb-3">
        {TABS.map((t) => (
          <Nav.Item key={t.key}><Nav.Link eventKey={t.key}>{t.label}</Nav.Link></Nav.Item>
        ))}
      </Nav>

      <Card>
        <Card.Body>
          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load endorsements" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-hand-thumbs-up" title={`No ${list.filters.status} endorsements`} message="Nothing to review here right now." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Batch</th>
                    <th>Requested by</th>
                    <th className="text-center">Readiness</th>
                    <th>Requested</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((e) => (
                    <tr key={e._id}>
                      <td>
                        <div className="fw-semibold">{fullName(e.agent)}</div>
                        <div className="small"><ProductionBadge status={e.agent?.productionStatus} always /></div>
                      </td>
                      <td className="small">{e.batch?.name || '-'}</td>
                      <td className="small">{fullName(e.requestedBy)}</td>
                      <td className="text-center fw-semibold">{e.snapshot?.readinessScore ?? '-'}</td>
                      <td className="small text-nowrap">{formatDate(e.createdAt)}</td>
                      <td className="text-end text-nowrap">
                        {e.status === 'pending' && (
                          <>
                            <Button size="sm" className="me-1" onClick={() => open(e, 'approve')}>Approve</Button>
                            <Button size="sm" variant="outline-secondary" onClick={() => open(e, 'reject')}>Reject</Button>
                          </>
                        )}
                        {e.status === 'approved' && (
                          <Button size="sm" variant="outline-secondary" onClick={() => open(e, 'revoke')}>Revoke</Button>
                        )}
                        {(e.status === 'rejected' || e.status === 'revoked') && e.decisionNote && (
                          <span className="small text-muted">{e.decisionNote}</span>
                        )}
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

      {/* Decision modal */}
      <Modal show={!!decision} onHide={() => !saving && setDecision(null)} centered>
        {decision && (
          <>
            <Modal.Header closeButton>
              <div>
                <Modal.Title className="h5">{ACTION[decision.mode].title}</Modal.Title>
                <p className="modal-subtitle">{fullName(decision.endorsement.agent)}</p>
              </div>
            </Modal.Header>
            <Modal.Body>
              <p className="small text-muted">{ACTION[decision.mode].help}</p>
              <Form.Group>
                <Form.Label htmlFor="dnote">Note {ACTION[decision.mode].requireNote ? '(required)' : '(optional)'}</Form.Label>
                <Form.Control id="dnote" as="textarea" rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(''); }} isInvalid={!!err} maxLength={1000} />
                <Form.Control.Feedback type="invalid">{err}</Form.Control.Feedback>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="light" onClick={() => setDecision(null)} disabled={saving}>Cancel</Button>
              <Button variant={ACTION[decision.mode].variant} onClick={confirm} disabled={saving}>
                {saving && <Spinner size="sm" className="me-2" />}
                {ACTION[decision.mode].verb}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}

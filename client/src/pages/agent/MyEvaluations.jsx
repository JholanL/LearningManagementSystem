/**
 * Agent → My Evaluations: QA scorecards from the trainer.
 * List (filter by acknowledged) → detail modal with per-criterion scores and coaching,
 * plus "Acknowledge" with an optional comment (locks the evaluation from further edits).
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { evaluationsApi } from '../../api/services';
import { formatDate, formatDateTime, fullName, getErrorMessage } from '../../utils/helpers';

const ratingTone = (rating) =>
  rating === 'Exceeds Expectations' ? 'badge-green' : rating === 'Meets Expectations' ? 'badge-blue' : rating === 'Needs Improvement' ? 'badge-amber' : 'badge-red';

const scoreVariant = (score) => (score >= 4 ? 'success' : score === 3 ? 'warning' : 'danger');

function AckBadge({ acknowledged }) {
  return acknowledged ? (
    <span className="badge-tone badge-green"><i className="bi bi-check2" /> Acknowledged</span>
  ) : (
    <span className="badge-tone badge-amber">Needs acknowledgement</span>
  );
}

function CoachingBlock({ icon, title, text }) {
  if (!text) return null;
  return (
    <div className="mb-3">
      <div className="small fw-semibold mb-1"><i className={`bi ${icon} me-1`} />{title}</div>
      <div className="article-body small bg-light rounded p-2">{text}</div>
    </div>
  );
}

export default function MyEvaluations() {
  const toast = useToast();
  const list = usePaginatedList(evaluationsApi.list, { acknowledged: '' });

  const [criteria, setCriteria] = useState({});
  useEffect(() => {
    evaluationsApi.criteria().then((res) => setCriteria(res.data)).catch(() => {});
  }, []);

  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const open = (ev) => {
    setSelected(ev);
    setComment('');
  };

  const acknowledge = async () => {
    setSaving(true);
    try {
      const res = await evaluationsApi.acknowledge(selected._id, comment.trim());
      toast.success('Evaluation acknowledged. Thanks!');
      setSelected((s) => ({ ...s, ...res.data, agent: s.agent, evaluator: s.evaluator }));
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="My Evaluations" icon="bi-clipboard-check" subtitle="QA scorecards from your trainer. Read the coaching notes and acknowledge each one." />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={8}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search call summaries..." />
            </Col>
            <Col md={4}>
              <Form.Select value={list.filters.acknowledged} onChange={(e) => list.setFilter('acknowledged', e.target.value)} aria-label="Filter by acknowledgement">
                <option value="">All evaluations</option>
                <option value="false">Needs acknowledgement</option>
                <option value="true">Acknowledged</option>
              </Form.Select>
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load evaluations" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            list.search || list.filters.acknowledged ? (
              <EmptyState icon="bi-search" title="No evaluations match" message="Try a different search or filter." />
            ) : (
              <EmptyState icon="bi-clipboard-check" title="No evaluations yet" message="Your trainer's QA scorecards for your mock calls will appear here." />
            )
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Call</th>
                    <th>Score</th>
                    <th className="d-none d-md-table-cell">Trainer</th>
                    <th className="d-none d-sm-table-cell">Date</th>
                    <th>Status</th>
                    <th className="text-end" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((ev) => (
                    <tr key={ev._id} role="button" onClick={() => open(ev)}>
                      <td style={{ maxWidth: 320 }}>
                        <div className="fw-semibold">{ev.callType} call</div>
                        <div className="small text-muted text-truncate">{ev.callSummary}</div>
                      </td>
                      <td className="text-nowrap">
                        <span className={`badge-tone ${ratingTone(ev.rating)}`}>{ev.overallScore}%</span>
                        <div className="small text-muted d-none d-lg-block">{ev.rating}</div>
                      </td>
                      <td className="d-none d-md-table-cell">{fullName(ev.evaluator)}</td>
                      <td className="small text-nowrap d-none d-sm-table-cell">{formatDate(ev.createdAt)}</td>
                      <td><AckBadge acknowledged={ev.acknowledged} /></td>
                      <td className="text-end">
                        <Button size="sm" variant={ev.acknowledged ? 'light' : 'primary'} aria-label={`Open evaluation from ${formatDate(ev.createdAt)}`}>
                          {ev.acknowledged ? 'View' : 'Review'}
                        </Button>
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

      {/* Detail modal */}
      <Modal show={!!selected} onHide={() => !saving && setSelected(null)} size="lg" centered scrollable>
        {selected && (
          <>
            <Modal.Header closeButton={!saving}>
              <div>
                <Modal.Title className="h5">{selected.callType} call evaluation</Modal.Title>
                <p className="modal-subtitle mb-0">
                  by {fullName(selected.evaluator)} · {formatDateTime(selected.createdAt)}
                </p>
              </div>
            </Modal.Header>
            <Modal.Body>
              <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                <div className="display-6 fw-bold">{selected.overallScore}%</div>
                <span className={`badge-tone ${ratingTone(selected.rating)}`}>{selected.rating}</span>
                <span className="ms-auto"><AckBadge acknowledged={selected.acknowledged} /></span>
              </div>

              <CoachingBlock icon="bi-telephone" title="Call summary" text={selected.callSummary} />

              <div className="small fw-semibold mb-2"><i className="bi bi-list-check me-1" />Scorecard</div>
              <div className="mb-3">
                {Object.entries(criteria).map(([key, { label, weight }]) => {
                  const score = selected.scores?.[key];
                  return (
                    <div key={key} className="mb-2">
                      <div className="d-flex justify-content-between small">
                        <span>{label} <span className="text-muted">({weight}%)</span></span>
                        <span className="fw-semibold">{score}/5</span>
                      </div>
                      <ProgressBar now={(score / 5) * 100} variant={scoreVariant(score)} style={{ height: 6 }} aria-label={`${label} score`} />
                    </div>
                  );
                })}
              </div>

              <CoachingBlock icon="bi-hand-thumbs-up" title="Strengths" text={selected.strengths} />
              <CoachingBlock icon="bi-arrow-up-circle" title="Areas for improvement" text={selected.areasForImprovement} />
              <CoachingBlock icon="bi-signpost-2" title="Coaching plan" text={selected.coachingPlan} />

              {selected.acknowledged ? (
                <Alert variant="success" className="small mb-0">
                  <i className="bi bi-check-circle-fill me-1" /> You acknowledged this on {formatDateTime(selected.acknowledgedAt)}.
                  {selected.agentComment && (
                    <div className="mt-2">
                      <span className="fw-semibold">Your comment:</span> {selected.agentComment}
                    </div>
                  )}
                </Alert>
              ) : (
                <Form.Group controlId="agentComment">
                  <Form.Label className="small fw-semibold">Your comment (optional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    maxLength={1000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="e.g. Noted, I'll practice the verification spiel before my next mock call."
                    disabled={saving}
                  />
                  <Form.Text>Acknowledging confirms you've read this coaching. The evaluation can no longer be edited afterwards.</Form.Text>
                </Form.Group>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="light" onClick={() => setSelected(null)} disabled={saving}>Close</Button>
              {!selected.acknowledged && (
                <Button onClick={acknowledge} disabled={saving}>
                  {saving ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-check2-circle me-1" />}
                  Acknowledge
                </Button>
              )}
            </Modal.Footer>
          </>
        )}
      </Modal>
    </>
  );
}

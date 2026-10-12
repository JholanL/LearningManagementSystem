/**
 * Leaderboard (shared by all roles).
 *  - Agent: their own batch, automatically.
 *  - Trainer / Admin: pick a batch (trainer sees own batches, admin all).
 * Ranks agents by Readiness Score = Quiz 50% + Simulator 30% + QA 20%.
 */
import { useEffect, useState } from 'react';
import { Badge, Card, Col, Form, Row, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ProductionBadge from '../../components/ProductionBadge';
import { useAuth } from '../../context/AuthContext';
import { batchesApi, leaderboardApi } from '../../api/services';
import { fullName, initials, getErrorMessage } from '../../utils/helpers';

const MEDAL = { 1: '#f2b705', 2: '#9ca3af', 3: '#b45309' };
const val = (n) => (n == null ? '—' : `${n}%`);

export default function Leaderboard() {
  const { user } = useAuth();
  const isStaff = user.role !== 'agent';

  const [batches, setBatches] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Staff pick a batch; load the list first.
  useEffect(() => {
    if (!isStaff) return;
    batchesApi
      .list({ limit: 100 })
      .then((res) => {
        setBatches(res.data);
        if (res.data.length) setBatchId(res.data[0]._id);
        else setLoading(false);
      })
      .catch((err) => { setError(getErrorMessage(err)); setLoading(false); });
  }, [isStaff]);

  // Load the leaderboard (agent: own batch; staff: selected batch).
  useEffect(() => {
    if (isStaff && !batchId) return undefined;
    let ignore = false;
    setLoading(true);
    setError('');
    leaderboardApi
      .get(isStaff ? batchId : undefined)
      .then((res) => !ignore && setBoard(res.data))
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [batchId, isStaff]);

  const weights = board?.weights;
  const weightNote = weights ? `Readiness = Quiz ${weights.quiz * 100}% · Simulator ${weights.simulator * 100}% · QA ${weights.evaluation * 100}%` : '';

  return (
    <>
      <PageHeader title="Leaderboard" icon="bi-trophy" subtitle={weightNote || 'Agent readiness ranking per batch.'} />

      {isStaff && (
        <Card className="mb-3">
          <Card.Body>
            <Row className="g-2 align-items-center">
              <Col xs="auto"><Form.Label className="mb-0">Batch</Form.Label></Col>
              <Col sm={6} md={4}>
                <Form.Select value={batchId} onChange={(e) => setBatchId(e.target.value)} aria-label="Select a batch">
                  {batches.length === 0 && <option value="">No batches</option>}
                  {batches.map((b) => <option key={b._id} value={b._id}>{b.name} · {b.account}</option>)}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load the leaderboard" message={error} />
      ) : !board || board.rows.length === 0 ? (
        <EmptyState icon="bi-trophy" title="No ranking yet" message="There are no active agents with activity in this batch." />
      ) : (
        <Card>
          <Card.Body>
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: 56 }}>#</th>
                    <th>Agent</th>
                    <th className="text-center">Readiness</th>
                    <th className="text-center d-none d-md-table-cell">Quiz</th>
                    <th className="text-center d-none d-md-table-cell">Simulator</th>
                    <th className="text-center d-none d-md-table-cell">QA</th>
                    <th className="text-center">Courses</th>
                  </tr>
                </thead>
                <tbody>
                  {board.rows.map((r) => (
                    <tr key={r.agent._id} className={r.isMe ? 'table-active' : undefined}>
                      <td className="text-center">
                        {MEDAL[r.rank] ? (
                          <span className="rank-medal" style={{ background: MEDAL[r.rank] }}>{r.rank}</span>
                        ) : (
                          <span className="text-muted fw-semibold">{r.rank}</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {r.agent.avatarUrl
                            ? <img src={r.agent.avatarUrl} alt="" className="avatar" style={{ width: 32, height: 32 }} />
                            : <span className="avatar avatar-initials" style={{ width: 32, height: 32 }}>{initials(r.agent)}</span>}
                          <div className="min-w-0">
                            <div className="fw-semibold">
                              {fullName(r.agent)} {r.isMe && <Badge bg="primary" className="ms-1">You</Badge>}
                            </div>
                            <div className="small text-muted d-flex flex-wrap align-items-center gap-2">
                              {r.agent.employeeId}
                              <ProductionBadge status={r.agent.productionStatus} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center"><span className="fw-bold fs-5 text-primary">{r.readinessScore}</span></td>
                      <td className="text-center d-none d-md-table-cell">{val(r.averageQuizScore)}</td>
                      <td className="text-center d-none d-md-table-cell">{val(r.averageSimulatorScore)}</td>
                      <td className="text-center d-none d-md-table-cell">{val(r.averageEvaluationScore)}</td>
                      <td className="text-center small">{r.coursesCompleted}/{r.totalCourses}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </>
  );
}

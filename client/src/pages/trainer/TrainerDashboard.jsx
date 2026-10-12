/**
 * Trainer dashboard: KPIs, at-risk agents, recent quiz attempts, and batch shortcuts.
 */
import { Link } from 'react-router-dom';
import { Badge, Button, Card, Col, Row, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import useFetch from '../../hooks/useFetch';
import { dashboardApi } from '../../api/services';
import { fullName, formatDate } from '../../utils/helpers';

export default function TrainerDashboard() {
  const { data, loading, error, reload } = useFetch(() => dashboardApi.trainer(), []);
  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load dashboard" message={error} action={<Button onClick={reload}>Retry</Button>} />;
  const d = data.data;

  return (
    <>
      <PageHeader title="Trainer Dashboard" icon="bi-grid-1x2" subtitle="Your batches, agents and training activity at a glance." />

      <Row className="g-3 mb-3">
        <Col sm={6} lg={2}><StatCard label="Agents" value={d.totalAgents} icon="bi-people" tone="blue" /></Col>
        <Col sm={6} lg={2}><StatCard label="Courses" value={`${d.courses.published}/${d.courses.total}`} icon="bi-journal-bookmark" tone="violet" hint="published" /></Col>
        <Col sm={6} lg={2}><StatCard label="Scenarios" value={d.scenarios} icon="bi-headset" tone="green" /></Col>
        <Col sm={6} lg={2}><StatCard label="Avg quiz" value={d.averageQuizScore != null ? `${d.averageQuizScore}%` : '-'} icon="bi-graph-up" tone="blue" /></Col>
        <Col sm={6} lg={2}><StatCard label="Pass rate" value={d.passRate != null ? `${d.passRate}%` : '-'} icon="bi-check2-circle" tone="green" /></Col>
        <Col sm={6} lg={2}><StatCard label="Pending QA" value={d.pendingAcknowledgments} icon="bi-clipboard-check" tone="amber" hint="to acknowledge" /></Col>
      </Row>

      <Row className="g-3">
        {/* At-risk agents */}
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header><i className="bi bi-exclamation-triangle text-warning me-1" /> At-risk agents</Card.Header>
            <Card.Body>
              {d.atRiskAgents.length === 0 ? (
                <p className="text-muted mb-0">No at-risk agents right now. 🎉</p>
              ) : (
                d.atRiskAgents.map((a) => (
                  <Link key={a.agent._id} to={`/trainer/batches/${a.agent.batch}`} className="d-flex align-items-center justify-content-between py-2 border-bottom text-decoration-none">
                    <span className="fw-semibold text-body">{fullName(a.agent)}</span>
                    <span className="small">
                      {a.averageScore != null && <span className="badge-tone badge-amber me-1">avg {a.averageScore}%</span>}
                      {a.quizzesLockedOut > 0 && <span className="badge-tone badge-red">{a.quizzesLockedOut} locked</span>}
                    </span>
                  </Link>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Recent attempts */}
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Recent quiz attempts</Card.Header>
            <Card.Body>
              {d.recentAttempts.length === 0 ? (
                <p className="text-muted mb-0">No attempts yet.</p>
              ) : (
                <div className="table-responsive">
                  <Table className="align-middle mb-0 small">
                    <tbody>
                      {d.recentAttempts.map((a) => (
                        <tr key={a._id}>
                          <td className="fw-semibold">{fullName(a.user)}</td>
                          <td className="text-truncate" style={{ maxWidth: 160 }}>{a.quiz?.title}</td>
                          <td className="text-center">{a.percentage}%</td>
                          <td className="text-end"><Badge bg={a.passed ? 'success' : 'secondary'}>{a.passed ? 'Passed' : 'Failed'}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Batches */}
        <Col xs={12}>
          <Card>
            <Card.Header>My batches</Card.Header>
            <Card.Body>
              {d.batches.length === 0 ? (
                <p className="text-muted mb-0">You don't handle any batches yet.</p>
              ) : (
                <Row className="g-2">
                  {d.batches.map((b) => (
                    <Col md={6} lg={4} key={b._id}>
                      <Link to={`/trainer/batches/${b._id}`} className="d-block border rounded p-3 text-decoration-none text-body h-100">
                        <div className="fw-semibold">{b.name}</div>
                        <div className="small text-muted">{b.account}</div>
                        <div className="small text-muted mt-1">{b.agentCount} agent(s) · {formatDate(b.startDate)}–{formatDate(b.endDate)}</div>
                        <span className="badge-tone badge-gray mt-2 d-inline-block text-capitalize">{b.status}</span>
                      </Link>
                    </Col>
                  ))}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

/**
 * Agent dashboard: KPIs, continue learning, course progress, production journey (feature 5),
 * daily drill (feature 7), latest QA evaluation and recent quiz attempts.
 */
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Col, ProgressBar, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import ProductionTimeline from '../../components/ProductionTimeline';
import useFetch from '../../hooks/useFetch';
import { authApi, dashboardApi, drillApi, leaderboardApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { formatDate, fullName } from '../../utils/helpers';

const pct = (v) => (v != null ? `${v}%` : '-');

export default function AgentDashboard() {
  const { user } = useAuth();
  const dash = useFetch(() => dashboardApi.agent(), []);
  const meRes = useFetch(() => authApi.me(), []); // fresh productionStatus/goLiveAt
  const drill = useFetch(() => drillApi.today(), []);
  // Readiness + rank come from the batch leaderboard; agents without a batch get a 400, so ignore errors
  const board = useFetch(() => (user.batch ? leaderboardApi.get() : Promise.resolve(null)), []);

  if (dash.loading) return <LoadingSpinner />;
  if (dash.error) {
    return <EmptyState icon="bi-exclamation-triangle" title="Could not load your dashboard" message={dash.error} action={<Button onClick={dash.reload}>Retry</Button>} />;
  }

  const d = dash.data.data;
  const me = meRes.data?.user || user;
  const dr = drill.data?.data;
  const myRow = board.data?.data?.rows?.find((r) => r.isMe);
  const batchSize = board.data?.data?.rows?.length;

  return (
    <>
      <PageHeader
        title={`Welcome, ${me.firstName}`}
        icon="bi-grid-1x2"
        subtitle={d.batch ? `${d.batch.name} · ${d.batch.account} · Trainer ${fullName(d.batch.trainer)}` : 'Your training dashboard'}
      />

      {!d.batch && (
        <Alert variant="info">
          <i className="bi bi-info-circle me-1" /> You're not assigned to a training batch yet. Your courses will appear once an admin adds you to one.
        </Alert>
      )}

      {/* KPIs */}
      <Row className="g-3 mb-3">
        <Col xs={6} lg={3}>
          <StatCard label="Overall progress" value={`${d.progress.overallPercent}%`} icon="bi-pie-chart" tone="blue" hint={`${d.progress.completedCourses}/${d.progress.totalCourses} courses done`} />
        </Col>
        <Col xs={6} lg={3}>
          <StatCard label="Avg quiz score" value={pct(d.averageQuizScore)} icon="bi-patch-check" tone="violet" hint="best per quiz" />
        </Col>
        <Col xs={6} lg={3}>
          <StatCard label="Simulator avg" value={pct(d.simulator.averageBestScore)} icon="bi-headset" tone="green" hint={`${d.simulator.scenariosPlayed} scenario${d.simulator.scenariosPlayed === 1 ? '' : 's'} played`} />
        </Col>
        <Col xs={6} lg={3}>
          <StatCard
            label="Readiness score"
            value={myRow ? pct(myRow.readinessScore) : '-'}
            icon="bi-trophy"
            tone="amber"
            hint={myRow ? <Link to="/agent/leaderboard">Rank #{myRow.rank} of {batchSize}</Link> : 'Quiz 50 · Sim 30 · QA 20'}
          />
        </Col>
      </Row>

      <Row className="g-3">
        {/* Left: learning */}
        <Col lg={8} className="d-flex flex-column gap-3">
          {d.continueLearning && (
            <Card className="border-primary">
              <Card.Body className="d-flex flex-wrap align-items-center gap-3">
                <div className="stat-icon tone-blue"><i className="bi bi-play-circle" /></div>
                <div className="flex-grow-1 min-w-0">
                  <div className="small text-muted">Continue where you left off</div>
                  <div className="fw-semibold text-truncate">{d.continueLearning.code} · {d.continueLearning.title}</div>
                </div>
                <Button as={Link} to={`/agent/courses/${d.continueLearning._id}`}>
                  Continue <i className="bi bi-arrow-right ms-1" />
                </Button>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Header className="d-flex align-items-center">
              <span><i className="bi bi-journal-bookmark me-1" /> My courses</span>
              <Link to="/agent/courses" className="ms-auto small">View all</Link>
            </Card.Header>
            <Card.Body>
              {d.courses.length === 0 ? (
                <p className="text-muted small mb-0">No courses assigned yet.</p>
              ) : (
                d.courses.map(({ course, percent, status }) => (
                  <Link key={course._id} to={`/agent/courses/${course._id}`} className="d-block py-2 border-bottom text-decoration-none text-body">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="fw-semibold text-truncate">{course.title}</span>
                      <span className="small text-muted d-none d-sm-inline">{course.code}</span>
                      <span className="ms-auto"><StatusBadge status={status} /></span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <ProgressBar now={percent} variant={status === 'completed' ? 'success' : undefined} className="flex-grow-1" style={{ height: 6 }} aria-label={`${course.title} progress`} />
                      <span className="small fw-semibold" style={{ width: 40, textAlign: 'right' }}>{percent}%</span>
                    </div>
                  </Link>
                ))
              )}
              {d.certificates > 0 && (
                <div className="small mt-3">
                  <i className="bi bi-award-fill text-success me-1" />
                  {d.certificates} certificate{d.certificates === 1 ? '' : 's'} earned · <Link to="/agent/certificates">View</Link>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><i className="bi bi-clock-history me-1" /> Recent quiz attempts</Card.Header>
            <Card.Body>
              {d.recentAttempts.length === 0 ? (
                <p className="text-muted small mb-0">No quiz attempts yet.</p>
              ) : (
                d.recentAttempts.map((a) => (
                  <div key={a._id} className="d-flex align-items-center gap-2 py-2 border-bottom small">
                    <span className="text-truncate flex-grow-1">{a.quiz?.title || 'Deleted quiz'}</span>
                    <span className="text-muted d-none d-sm-inline">{formatDate(a.createdAt)}</span>
                    <span className="fw-semibold">{a.percentage}%</span>
                    <StatusBadge status={a.passed ? 'passed' : 'failed'} />
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Right: status, drill, coaching */}
        <Col lg={4} className="d-flex flex-column gap-3">
          <Card>
            <Card.Header>Your production journey</Card.Header>
            <Card.Body>
              {meRes.loading ? <LoadingSpinner /> : <ProductionTimeline status={me.productionStatus} goLiveAt={me.goLiveAt} />}
              {me.productionStatus === 'endorsed' && <p className="small text-muted mt-3 mb-0"><i className="bi bi-hourglass-split me-1" />Your trainer endorsed you — waiting for admin approval.</p>}
              {me.productionStatus === 'production' && <p className="small text-success mt-3 mb-0"><i className="bi bi-check-circle me-1" />You're production ready. Congratulations!</p>}
            </Card.Body>
          </Card>

          {/* Daily drill (feature 7) */}
          <Card className="drill-card">
            <Card.Body className="d-flex flex-wrap align-items-center gap-3">
              <div className="stat-icon tone-amber"><i className="bi bi-lightning-charge" /></div>
              <div className="flex-grow-1 min-w-0">
                {drill.loading ? (
                  <span className="text-muted small">Loading daily drill…</span>
                ) : drill.error ? (
                  <span className="text-muted small">Daily drill is unavailable right now.</span>
                ) : dr?.empty ? (
                  <>
                    <div className="fw-semibold">Daily drill</div>
                    <div className="small text-muted">Available once you're assigned courses.</div>
                  </>
                ) : dr?.completed ? (
                  <>
                    <div className="fw-semibold">Done for today ✓</div>
                    <div className="small text-muted">Score {dr.score}/{dr.total} · {dr.streak}-day streak 🔥</div>
                  </>
                ) : (
                  <>
                    <div className="fw-semibold">Daily drill · {dr?.total || 5} questions</div>
                    <div className="small text-muted">{dr?.streak ? `${dr.streak}-day streak 🔥 · keep it going!` : 'Build a daily practice streak.'}</div>
                  </>
                )}
              </div>
              {dr && !dr.empty && (
                <Button as={Link} to="/agent/drill" variant={dr.completed ? 'light' : 'primary'}>
                  {dr.completed ? 'Review' : 'Start'}
                </Button>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header><i className="bi bi-clipboard-check me-1" /> Latest QA evaluation</Card.Header>
            <Card.Body>
              {d.pendingAcknowledgments > 0 && (
                <Alert variant="warning" className="small py-2">
                  <i className="bi bi-bell me-1" />
                  {d.pendingAcknowledgments} evaluation{d.pendingAcknowledgments === 1 ? '' : 's'} waiting for your acknowledgement.
                </Alert>
              )}
              {d.latestEvaluation ? (
                <>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fs-3 fw-bold">{d.latestEvaluation.overallScore}%</span>
                    <span className="small text-muted">{d.latestEvaluation.rating}</span>
                  </div>
                  <div className="small text-muted mb-2">
                    {d.latestEvaluation.callType} call · {formatDate(d.latestEvaluation.createdAt)}
                  </div>
                  <Button as={Link} to="/agent/evaluations" size="sm" variant={d.pendingAcknowledgments ? 'primary' : 'light'}>
                    {d.pendingAcknowledgments ? 'Review & acknowledge' : 'View evaluations'}
                  </Button>
                </>
              ) : (
                <p className="text-muted small mb-0">No evaluations yet. Your trainer will score your mock calls here.</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

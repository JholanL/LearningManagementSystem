/**
 * Agent dashboard. NOTE: the full dashboard is still in the agent build order;
 * this adds the production-journey timeline (feature 5) now. The rest (progress
 * cards, daily drill, etc.) is listed as TODO below.
 */
import { Link } from 'react-router-dom';
import { Button, Card } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProductionTimeline from '../../components/ProductionTimeline';
import useFetch from '../../hooks/useFetch';
import { authApi, drillApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';

const TODO = [
  'Progress summary cards (courses, quizzes, readiness)',
  'Daily drill card (feature 7)',
  'Recent certificates and evaluations',
];

export default function AgentDashboard() {
  const { user } = useAuth();
  const { data, loading } = useFetch(() => authApi.me(), []); // fresh productionStatus/goLiveAt
  const me = data?.user || user;
  const drill = useFetch(() => drillApi.today(), []);
  const d = drill.data?.data;

  return (
    <>
      <PageHeader title={`Welcome, ${me.firstName}`} icon="bi-grid-1x2" subtitle={me.batch?.name ? `${me.batch.name}` : 'Your training dashboard'} />

      <Card className="mb-3">
        <Card.Header>Your production journey</Card.Header>
        <Card.Body>
          {loading ? <LoadingSpinner /> : <ProductionTimeline status={me.productionStatus} goLiveAt={me.goLiveAt} />}
          {me.productionStatus === 'endorsed' && <p className="small text-muted mt-3 mb-0"><i className="bi bi-hourglass-split me-1" />Your trainer endorsed you — waiting for admin approval.</p>}
          {me.productionStatus === 'production' && <p className="small text-success mt-3 mb-0"><i className="bi bi-check-circle me-1" />You're production ready. Congratulations!</p>}
        </Card.Body>
      </Card>

      {/* Daily drill (feature 7) */}
      <Card className="mb-3 drill-card">
        <Card.Body className="d-flex flex-wrap align-items-center gap-3">
          <div className="stat-icon tone-amber"><i className="bi bi-lightning-charge" /></div>
          <div className="flex-grow-1 min-w-0">
            {drill.loading ? (
              <span className="text-muted small">Loading daily drill…</span>
            ) : d?.empty ? (
              <>
                <div className="fw-semibold">Daily drill</div>
                <div className="small text-muted">Available once you're assigned courses.</div>
              </>
            ) : d?.completed ? (
              <>
                <div className="fw-semibold">Done for today ✓</div>
                <div className="small text-muted">Score {d.score}/{d.total} · {d.streak}-day streak 🔥</div>
              </>
            ) : (
              <>
                <div className="fw-semibold">Daily drill · {d?.total || 5} questions</div>
                <div className="small text-muted">{d?.streak ? `${d.streak}-day streak 🔥 · keep it going!` : 'Build a daily practice streak.'}</div>
              </>
            )}
          </div>
          {!d?.empty && (
            <Button as={Link} to="/agent/drill" variant={d?.completed ? 'light' : 'primary'}>
              {d?.completed ? 'Review' : 'Start'}
            </Button>
          )}
        </Card.Body>
      </Card>

      <Card className="todo-card">
        <Card.Body>
          <h2 className="h6"><i className="bi bi-cone-striped me-2" />Dashboard widgets — to build</h2>
          <ul className="small mb-0">
            {TODO.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </Card.Body>
      </Card>
    </>
  );
}

/**
 * Course-level analytics (feature 3): lesson completion funnel + per-quiz summary.
 * Rendered inside the Course Builder "Analytics" tab.
 */
import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Table } from 'react-bootstrap';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import StatCard from './StatCard';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { analyticsApi } from '../api/services';
import { ROLE_HOME } from '../utils/helpers';

const BRAND = '#1d4ed8';
const GRID = '#e2e8f0';

export default function CourseAnalytics({ courseId }) {
  const { user } = useAuth();
  const base = ROLE_HOME[user.role];
  const { data, loading, error, reload } = useFetch(() => analyticsApi.course(courseId), [courseId]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load analytics" message={error} action={<Button onClick={reload}>Retry</Button>} />;

  const { lessonFunnel, quizzes, simulator, agentCount } = data.data;
  const funnelData = lessonFunnel.map((l) => ({ name: `L${l.order}`, title: l.title, completed: l.completed }));

  return (
    <>
      <Row className="g-3 mb-3">
        <Col sm={4}><StatCard label="Audience agents" value={agentCount} icon="bi-people" tone="blue" /></Col>
        <Col sm={4}><StatCard label="Quizzes" value={quizzes.length} icon="bi-ui-checks" tone="violet" /></Col>
        <Col sm={4}><StatCard label="Simulator runs" value={simulator.attempts} icon="bi-headset" tone="green" hint={`${simulator.agents} agents`} /></Col>
      </Row>

      <Card className="mb-3">
        <Card.Header>Lesson completion funnel</Card.Header>
        <Card.Body>
          {funnelData.length === 0 ? (
            <p className="text-muted mb-0">No lessons yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v} agents`, 'Completed']} labelFormatter={(l, p) => p?.[0]?.payload?.title || l} />
                <Bar dataKey="completed" name="Completed" fill={BRAND} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Quizzes</Card.Header>
        <Card.Body>
          {quizzes.length === 0 ? (
            <p className="text-muted mb-0">No quizzes in this course yet.</p>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Quiz</th>
                    <th className="text-center">Attempts</th>
                    <th className="text-center">Agents</th>
                    <th className="text-center">Avg</th>
                    <th className="text-center">Pass rate</th>
                    <th className="text-end">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((q) => (
                    <tr key={q.quizId}>
                      <td className="fw-semibold">{q.title} <span className="text-muted small">· {q.questionCount} Qs</span></td>
                      <td className="text-center">{q.attempts}</td>
                      <td className="text-center">{q.uniqueAgents}</td>
                      <td className="text-center">{q.avgScore}%</td>
                      <td className="text-center">{q.passRate}%</td>
                      <td className="text-end">
                        <Button size="sm" variant="light" as={Link} to={`${base}/quizzes/${q.quizId}/analytics`}>
                          <i className="bi bi-bar-chart-line me-1" /> Analytics
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </>
  );
}

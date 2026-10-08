/**
 * Quiz analytics (feature 3). Owner trainer or admin.
 * KPI cards, score distribution, per-question correct-rate (red bars < 60%),
 * per-question option breakdown, and a "Needs review" list.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Row } from 'react-bootstrap';
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { analyticsApi } from '../../api/services';
import { ROLE_HOME } from '../../utils/helpers';

const BRAND = '#1d4ed8';
const RED = '#c42b2b';
const GRID = '#e2e8f0';

export default function QuizAnalytics() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = ROLE_HOME[user.role];
  const { data, loading, error } = useFetch(() => analyticsApi.quiz(id), [id]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return <EmptyState icon="bi-exclamation-triangle" title="Could not load analytics" message={error} action={<Button onClick={() => navigate(-1)}>Back</Button>} />;
  }

  const { quiz, summary, distribution, questions } = data.data;
  const needsReview = questions.filter((q) => q.needsReview);
  const correctRateData = questions.map((q, i) => ({ name: `Q${i + 1}`, correctRate: q.correctRate, needsReview: q.needsReview }));
  const editQuestion = (questionId) => navigate(`${base}/quizzes/${quiz._id}?q=${questionId}`);

  return (
    <>
      <PageHeader
        title={`Analytics · ${quiz.title}`}
        icon="bi-bar-chart-line"
        subtitle={`${quiz.courseCode} · ${quiz.courseTitle} · pass mark ${quiz.passingScore}%`}
        actions={<Button variant="light" onClick={() => navigate(-1)}><i className="bi bi-arrow-left me-1" /> Back</Button>}
      />

      {summary.attempts === 0 ? (
        <EmptyState icon="bi-bar-chart" title="No attempts yet" message="Analytics will appear once agents take this quiz." />
      ) : (
        <>
          {/* KPI cards */}
          <Row className="g-3 mb-3">
            <Col sm={6} lg={2}><StatCard label="Attempts" value={summary.attempts} icon="bi-arrow-repeat" tone="blue" /></Col>
            <Col sm={6} lg={2}><StatCard label="Agents" value={summary.uniqueAgents} icon="bi-people" tone="blue" /></Col>
            <Col sm={6} lg={2}><StatCard label="Avg score" value={`${summary.avgScore}%`} icon="bi-graph-up" tone="green" /></Col>
            <Col sm={6} lg={2}><StatCard label="Pass rate" value={`${summary.passRate}%`} icon="bi-check2-circle" tone="green" /></Col>
            <Col sm={6} lg={2}><StatCard label="1st-try pass" value={`${summary.firstAttemptPassRate}%`} icon="bi-1-circle" tone="amber" /></Col>
            <Col sm={6} lg={2}><StatCard label="Avg tries to pass" value={summary.avgAttemptsToPass ?? '-'} icon="bi-stack" tone="violet" /></Col>
          </Row>

          {needsReview.length > 0 && (
            <Alert variant="warning" className="d-flex flex-wrap align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill" />
              <strong>{needsReview.length} question{needsReview.length > 1 ? 's' : ''} need review</strong> (under 60% correct).
              <span className="ms-auto d-flex flex-wrap gap-2">
                {needsReview.map((q) => (
                  <Button key={q.questionId} size="sm" variant="outline-secondary" onClick={() => editQuestion(q.questionId)}>
                    <i className="bi bi-pencil me-1" /> Edit Q{questions.indexOf(q) + 1}
                  </Button>
                ))}
              </span>
            </Alert>
          )}

          <Row className="g-3 mb-3">
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>Score distribution</Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Attempts" fill={BRAND} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="h-100">
                <Card.Header>Correct rate per question <span className="small text-muted">(red = needs review)</span></Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={correctRateData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="correctRate" name="Correct %" radius={[4, 4, 0, 0]}>
                        {correctRateData.map((d) => (
                          <Cell key={d.name} fill={d.needsReview ? RED : BRAND} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Per-question option breakdown */}
          <Card>
            <Card.Header>Question breakdown</Card.Header>
            <Card.Body>
              {questions.map((q, i) => {
                const total = q.optionCounts.reduce((s, c) => s + c, 0) || 1;
                return (
                  <div key={q.questionId} className="mb-4 pb-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div className="fw-semibold">
                        Q{i + 1}. {q.text}
                        <span className={`badge-tone ms-2 ${q.needsReview ? 'badge-red' : 'badge-green'}`}>{q.correctRate}% correct</span>
                      </div>
                      <Button size="sm" variant="light" onClick={() => editQuestion(q.questionId)}><i className="bi bi-pencil" /></Button>
                    </div>
                    {q.options.map((opt, oi) => {
                      const count = q.optionCounts[oi];
                      const pct = Math.round((100 * count) / total);
                      const isCorrect = oi === q.correctAnswer;
                      const isTopWrong = oi === q.topWrongOption;
                      return (
                        <div key={oi} className="opt-row">
                          <div className="opt-label">
                            {isCorrect && <i className="bi bi-check-circle-fill text-success me-1" />}
                            {isTopWrong && <i className="bi bi-exclamation-circle-fill text-danger me-1" />}
                            {opt}
                          </div>
                          <div className="opt-bar"><div className={`opt-fill ${isCorrect ? 'opt-correct' : isTopWrong ? 'opt-wrong' : ''}`} style={{ width: `${pct}%` }} /></div>
                          <div className="opt-count small text-muted">{count} ({pct}%)</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Card.Body>
          </Card>
        </>
      )}
    </>
  );
}

/**
 * Agent → Take Quiz (/agent/quizzes/:id). Three phases:
 *   intro  → rules, attempts left, past attempts
 *   taking → all questions on one page, countdown timer (auto-submits at 0)
 *   result → score + review. Grading happens on the server; correct answers are only
 *            returned after passing or using the last attempt (no copying on the next try).
 * The time limit is enforced client-side only (documented limitation).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Form, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';
import StatusBadge from '../../components/StatusBadge';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { quizzesApi } from '../../api/services';
import { formatDateTime, getErrorMessage } from '../../utils/helpers';

const formatClock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function TakeQuiz() {
  const { id } = useParams();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => quizzesApi.get(id), [id]);
  const history = useFetch(() => quizzesApi.attempts(id, { limit: 10 }), [id]);

  const [phase, setPhase] = useState('intro'); // intro | taking | result
  const [answers, setAnswers] = useState([]);
  const [remaining, setRemaining] = useState(null); // seconds, null = no time limit
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Refs so the timer's auto-submit always sees the latest answers and can't submit twice
  const answersRef = useRef([]);
  const startedAtRef = useRef(0);
  const submittingRef = useRef(false);

  const quiz = data?.data;

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmOpen(false);
    try {
      const timeTaken = Math.round((Date.now() - startedAtRef.current) / 1000);
      const payload = answersRef.current.map((a) => a ?? -1); // API expects -1 for a blank answer
      const res = await quizzesApi.submit(id, payload, timeTaken);
      setResult(res.data);
      setPhase('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (res.data.certificate) toast.success('Course completed! Your certificate has been issued. 🎉');
    } catch (err) {
      toast.error(getErrorMessage(err));
      submittingRef.current = false; // allow retrying after a network error
    } finally {
      setSubmitting(false);
    }
  }, [id, toast]);

  // Countdown: recompute from the deadline each tick (stays accurate even if the tab sleeps)
  useEffect(() => {
    if (phase !== 'taking' || !quiz?.timeLimitMinutes) return undefined;
    const deadline = startedAtRef.current + quiz.timeLimitMinutes * 60 * 1000;
    const timer = setInterval(() => {
      const left = (deadline - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        toast.info("Time's up! Submitting your answers.");
        submit();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [phase, quiz?.timeLimitMinutes, submit, toast]);

  // Warn before closing/refreshing the tab mid-quiz
  useEffect(() => {
    if (phase !== 'taking') return undefined;
    const warn = (e) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="bi-patch-exclamation"
        title="Quiz not available"
        message={error}
        action={
          <div className="d-flex gap-2 justify-content-center">
            <Button onClick={reload}>Retry</Button>
            <Button variant="light" as={Link} to="/agent/courses">My Courses</Button>
          </div>
        }
      />
    );
  }

  const courseUrl = `/agent/courses/${quiz.course}`;
  const total = quiz.questions.length;
  const answeredCount = answers.filter((a) => a !== null && a !== undefined).length;

  const start = () => {
    const empty = Array(total).fill(null);
    setAnswers(empty);
    answersRef.current = empty;
    startedAtRef.current = Date.now();
    submittingRef.current = false;
    setRemaining(quiz.timeLimitMinutes ? quiz.timeLimitMinutes * 60 : null);
    setResult(null);
    setPhase('taking');
    window.scrollTo({ top: 0 });
  };

  const choose = (qIndex, optionIndex) => {
    const next = answers.map((a, i) => (i === qIndex ? optionIndex : a));
    setAnswers(next);
    answersRef.current = next;
  };

  const onSubmitClick = () => (answeredCount < total ? setConfirmOpen(true) : submit());

  const retake = () => {
    reload();
    history.reload();
    setPhase('intro');
  };

  const header = (
    <PageHeader
      title={quiz.title}
      icon="bi-pencil-square"
      subtitle={quiz.courseTitle}
      actions={
        phase !== 'taking' && (
          <Button variant="light" as={Link} to={courseUrl}>
            <i className="bi bi-arrow-left me-1" /> Course outline
          </Button>
        )
      }
    />
  );

  /* ---------------- INTRO ---------------- */
  if (phase === 'intro') {
    const canTake = !quiz.passed && quiz.attemptsLeft > 0 && total > 0;
    const attempts = history.data?.data || [];
    return (
      <>
        {header}
        <Row className="g-3">
          <Col lg={7}>
            <Card className="h-100">
              <Card.Body>
                {quiz.description && <p className="text-muted">{quiz.description}</p>}
                <Row className="g-3 text-center mb-3">
                  {[
                    ['bi-list-ol', total, 'Questions'],
                    ['bi-bullseye', `${quiz.passingScore}%`, 'To pass'],
                    ['bi-stopwatch', quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : 'None', 'Time limit'],
                    ['bi-arrow-repeat', `${quiz.attemptsLeft}/${quiz.maxAttempts}`, 'Attempts left'],
                  ].map(([icon, value, label]) => (
                    <Col xs={6} sm={3} key={label}>
                      <div className="border rounded-3 py-2 h-100">
                        <i className={`bi ${icon} text-primary`} />
                        <div className="fw-bold">{value}</div>
                        <div className="small text-muted">{label}</div>
                      </div>
                    </Col>
                  ))}
                </Row>

                {quiz.passed ? (
                  <Alert variant="success" className="mb-0">
                    <i className="bi bi-check-circle-fill me-1" /> You passed this quiz with a best score of <strong>{quiz.bestScore}%</strong>.
                  </Alert>
                ) : quiz.attemptsLeft === 0 ? (
                  <Alert variant="danger" className="mb-0">
                    <i className="bi bi-lock-fill me-1" /> You've used all {quiz.maxAttempts} attempts. Please coordinate with your trainer.
                  </Alert>
                ) : total === 0 ? (
                  <Alert variant="warning" className="mb-0">This quiz has no questions yet.</Alert>
                ) : (
                  <>
                    <ul className="small text-muted ps-3">
                      <li>Your attempt only counts when you submit.</li>
                      {quiz.timeLimitMinutes > 0 && <li>When the timer reaches 0:00 your answers are submitted automatically.</li>}
                      <li>If you don't pass, the correct answers stay hidden until you pass or use your last attempt.</li>
                    </ul>
                    <div className="d-grid d-sm-block">
                      <Button size="lg" onClick={start} disabled={!canTake}>
                        <i className="bi bi-play-fill me-1" /> {quiz.attemptsUsed > 0 ? 'Retake quiz' : 'Start quiz'}
                      </Button>
                    </div>
                  </>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={5}>
            <Card className="h-100">
              <Card.Header><i className="bi bi-clock-history me-1" /> Your attempts</Card.Header>
              <Card.Body>
                {history.loading ? (
                  <LoadingSpinner />
                ) : history.error ? (
                  <p className="small text-danger mb-0">{history.error}</p>
                ) : attempts.length === 0 ? (
                  <p className="small text-muted mb-0">No attempts yet.</p>
                ) : (
                  <div className="table-responsive">
                    <Table size="sm" className="align-middle mb-0">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Score</th>
                          <th>Result</th>
                          <th className="d-none d-sm-table-cell">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attempts.map((a) => (
                          <tr key={a._id}>
                            <td>{a.attemptNumber}</td>
                            <td className="fw-semibold">{a.percentage}%</td>
                            <td><StatusBadge status={a.passed ? 'passed' : 'failed'} /></td>
                            <td className="small text-muted d-none d-sm-table-cell">{formatDateTime(a.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </>
    );
  }

  /* ---------------- TAKING ---------------- */
  if (phase === 'taking') {
    const lowTime = remaining !== null && remaining <= 60;
    return (
      <>
        {header}

        {/* Sticky status bar under the 64px topbar: answered count + timer */}
        <Card className="mb-3 shadow-sm" style={{ position: 'sticky', top: 72, zIndex: 1010 }}>
          <Card.Body className="py-2 d-flex align-items-center gap-3">
            <div className="flex-grow-1">
              <div className="small text-muted mb-1">
                Answered {answeredCount} of {total}
              </div>
              <ProgressBar now={(answeredCount / total) * 100} style={{ height: 6 }} aria-label="Questions answered" />
            </div>
            {remaining !== null && (
              <div className={`fw-bold fs-5 font-monospace ${lowTime ? 'text-danger' : ''}`} role="timer" aria-live={lowTime ? 'polite' : 'off'}>
                <i className="bi bi-stopwatch me-1" />
                {formatClock(remaining)}
              </div>
            )}
          </Card.Body>
        </Card>

        {quiz.questions.map((q, qi) => (
          <Card key={q._id} className="mb-3">
            <Card.Body>
              <fieldset disabled={submitting}>
                <legend className="fs-6 fw-semibold mb-3">
                  <span className="text-muted me-1">{qi + 1}.</span> {q.question}
                  {q.points > 1 && <span className="small text-muted fw-normal"> ({q.points} pts)</span>}
                </legend>
                {q.options.map((opt, oi) => (
                  <Form.Check
                    key={oi}
                    type="radio"
                    id={`q${qi}-o${oi}`}
                    name={`q${qi}`}
                    label={opt}
                    checked={answers[qi] === oi}
                    onChange={() => choose(qi, oi)}
                    className="mb-2"
                  />
                ))}
              </fieldset>
            </Card.Body>
          </Card>
        ))}

        <div className="d-grid d-sm-flex justify-content-sm-end mb-4">
          <Button size="lg" onClick={onSubmitClick} disabled={submitting}>
            {submitting ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-send me-1" />}
            Submit answers
          </Button>
        </div>

        <ConfirmModal
          show={confirmOpen}
          title="Submit with blank answers?"
          message={`You answered ${answeredCount} of ${total} questions. Blank answers are marked wrong, and this uses one of your attempts.`}
          confirmText="Submit anyway"
          variant="primary"
          loading={submitting}
          onConfirm={submit}
          onCancel={() => setConfirmOpen(false)}
        />
      </>
    );
  }

  /* ---------------- RESULT ---------------- */
  const r = result;
  const correctCount = r.review.filter((x) => x.isCorrect).length;
  return (
    <>
      {header}

      <Card className={`mb-3 ${r.passed ? 'border-success' : 'border-danger'}`}>
        <Card.Body className="text-center py-4">
          <div className={`display-5 fw-bold ${r.passed ? 'text-success' : 'text-danger'}`}>{r.percentage}%</div>
          <div className="mb-2">
            <StatusBadge status={r.passed ? 'passed' : 'failed'} />
          </div>
          <p className="text-muted mb-1">
            {correctCount} of {r.review.length} correct · {r.score}/{r.totalPoints} points · pass mark {r.passingScore}%
          </p>
          <p className="small text-muted">
            Attempt {r.attemptNumber}
            {!r.passed && ` · ${r.attemptsLeft} attempt${r.attemptsLeft === 1 ? '' : 's'} left`}
          </p>

          {r.certificate && (
            <Alert variant="success" className="d-inline-block text-start">
              <i className="bi bi-award-fill me-1" /> <strong>Course completed!</strong> Certificate{' '}
              <span className="font-monospace">{r.certificate.code}</span> has been issued.{' '}
              <Link to="/agent/certificates">View my certificates</Link>
            </Alert>
          )}
          {!r.passed && r.attemptsLeft === 0 && (
            <Alert variant="danger" className="d-inline-block text-start">
              <i className="bi bi-lock-fill me-1" /> No attempts left. Your trainer has been notified and will coach you on this topic.
            </Alert>
          )}

          <div className="d-flex flex-wrap gap-2 justify-content-center">
            {!r.passed && r.attemptsLeft > 0 && (
              <Button onClick={retake}>
                <i className="bi bi-arrow-repeat me-1" /> Try again
              </Button>
            )}
            <Button variant={r.passed ? 'primary' : 'light'} as={Link} to={courseUrl}>
              Back to course
            </Button>
          </div>
        </Card.Body>
      </Card>

      <h2 className="h6 fw-bold mb-2">Review</h2>
      {!r.answersRevealed && (
        <Alert variant="info" className="small">
          <i className="bi bi-eye-slash me-1" /> Correct answers are hidden until you pass or use your last attempt. Review the lessons and try again.
        </Alert>
      )}
      {r.review.map((item, qi) => (
        <Card key={item.questionId} className={`mb-2 border-start border-4 ${item.isCorrect ? 'border-success' : 'border-danger'}`}>
          <Card.Body>
            <div className="d-flex gap-2 fw-semibold mb-2">
              <i className={`bi ${item.isCorrect ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`} />
              <span>{qi + 1}. {item.question}</span>
            </div>
            <ul className="list-unstyled small mb-0 ps-4">
              {item.options.map((opt, oi) => {
                const selected = item.selected === oi;
                const correct = r.answersRevealed && item.correctAnswer === oi;
                return (
                  <li key={oi} className={`mb-1 ${correct ? 'text-success fw-semibold' : selected && !item.isCorrect ? 'text-danger' : 'text-muted'}`}>
                    <i className={`bi ${selected ? 'bi-record-circle' : 'bi-circle'} me-1`} />
                    {opt}
                    {selected && <span className="ms-1">(your answer)</span>}
                    {correct && !selected && <span className="ms-1">(correct answer)</span>}
                  </li>
                );
              })}
              {item.selected === -1 && <li className="text-danger">No answer given</li>}
            </ul>
            {r.answersRevealed && item.explanation && (
              <div className="small bg-light rounded p-2 mt-2">
                <i className="bi bi-lightbulb me-1 text-warning" /> {item.explanation}
              </div>
            )}
          </Card.Body>
        </Card>
      ))}
    </>
  );
}

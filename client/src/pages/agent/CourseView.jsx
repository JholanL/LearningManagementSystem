/**
 * Agent → Course outline (/agent/courses/:id).
 * Shows the course as ONE ordered path: Lesson 1 → its quiz → Lesson 2 → its quiz
 * → … → final quiz(zes). Each step unlocks only when the previous one is done
 * (lesson completed / quiz passed). The API enforces the same order.
 */
import { Link, useParams } from 'react-router-dom';
import { Button, Card, Col, ListGroup, ProgressBar, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import useFetch from '../../hooks/useFetch';
import { coursesApi } from '../../api/services';
import { formatDate } from '../../utils/helpers';

const BACK = (
  <Button variant="light" as={Link} to="/agent/courses">
    <i className="bi bi-arrow-left me-1" /> My Courses
  </Button>
);

// Interleave lessons with their quizzes, then course-level (final) quizzes at the end.
function buildSteps(course) {
  const steps = [];
  (course.lessons || []).forEach((l) => {
    steps.push({ kind: 'lesson', item: l });
    (course.quizzes || [])
      .filter((q) => q.lesson && String(q.lesson) === String(l._id))
      .forEach((q) => steps.push({ kind: 'quiz', item: q }));
  });
  (course.quizzes || []).filter((q) => !q.lesson).forEach((q) => steps.push({ kind: 'quiz', item: q, final: true }));
  return steps;
}

export default function CourseView() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => coursesApi.get(id), [id]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="bi-journal-x"
        title="Course not available"
        message={error}
        action={<div className="d-flex gap-2 justify-content-center"><Button onClick={reload}>Retry</Button>{BACK}</div>}
      />
    );
  }

  const course = data.data;
  const progress = course.progress || { percent: 0, status: 'not_started', completedLessons: 0, totalLessons: 0, passedQuizzes: 0, totalQuizzes: 0 };
  const steps = buildSteps(course);
  const isDone = (s) => (s.kind === 'lesson' ? !!s.item.completed : !!s.item.passed);
  const firstNotDone = steps.findIndex((s) => !isDone(s));
  const current = firstNotDone === -1 ? null : steps[firstNotDone];
  const currentTo = current
    ? (current.kind === 'lesson' ? `/agent/lessons/${current.item._id}` : `/agent/quizzes/${current.item._id}`)
    : null;

  return (
    <>
      <PageHeader title={course.title} icon="bi-journal-text" subtitle={`${course.code} · ${course.category} · ${course.level}`} actions={BACK} />

      {/* Progress summary */}
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3 align-items-center">
            <Col lg={8}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <StatusBadge status={progress.status} />
                <span className="small text-muted">
                  {progress.completedLessons}/{progress.totalLessons} lessons · {progress.passedQuizzes}/{progress.totalQuizzes} quizzes passed
                </span>
                <span className="ms-auto fw-semibold">{progress.percent}%</span>
              </div>
              <ProgressBar now={progress.percent} variant={progress.status === 'completed' ? 'success' : undefined} style={{ height: 10 }} aria-label="Course progress" />
              <p className="small text-muted mb-0 mt-3">{course.description}</p>
            </Col>
            <Col lg={4} className="text-lg-end">
              {currentTo ? (
                <div className="d-grid d-lg-block">
                  <Button as={Link} to={currentTo} className="text-truncate" style={{ maxWidth: '100%' }}>
                    {current.kind === 'lesson' ? 'Continue' : 'Take quiz'}: {current.item.title} <i className="bi bi-arrow-right ms-1" />
                  </Button>
                </div>
              ) : progress.status === 'completed' ? (
                <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1" /> Course completed</span>
              ) : null}
              <div className="small text-muted mt-2">Pass mark {course.passingScore}% · {course.maxAttempts} attempts per quiz</div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Certificate */}
      {course.certificate && (
        <Card className="mb-3 border-success">
          <Card.Body className="d-flex flex-wrap align-items-center gap-3">
            <div className="fs-2 text-success"><i className="bi bi-award-fill" /></div>
            <div className="flex-grow-1">
              <div className="fw-semibold">Certificate earned</div>
              <div className="small text-muted">
                Code <span className="font-monospace">{course.certificate.code}</span> · issued {formatDate(course.certificate.issuedAt)}
                {course.certificate.finalScore != null && <> · final score {course.certificate.finalScore}%</>}
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button as={Link} to="/agent/certificates" size="sm"><i className="bi bi-download me-1" /> Download PDF</Button>
              <Button as={Link} to={`/verify/${course.certificate.code}`} size="sm" variant="outline-primary" target="_blank" rel="noopener noreferrer"><i className="bi bi-patch-check me-1" /> Verify</Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Course path */}
      <Card>
        <Card.Header><i className="bi bi-signpost-split me-1" /> Course path</Card.Header>
        {steps.length === 0 ? (
          <Card.Body><EmptyState icon="bi-journal-text" title="Nothing here yet" message="Your trainer hasn't added lessons or quizzes to this course." /></Card.Body>
        ) : (
          <ListGroup variant="flush">
            {steps.map((s, i) => {
              const done = isDone(s);
              const locked = firstNotDone !== -1 && i > firstNotDone;
              const to = s.kind === 'lesson' ? `/agent/lessons/${s.item._id}` : `/agent/quizzes/${s.item._id}`;
              const attemptsLeft = s.kind === 'quiz' ? Math.max(course.maxAttempts - (s.item.attemptsUsed || 0), 0) : 0;
              const lockedOut = s.kind === 'quiz' && !s.item.passed && attemptsLeft === 0 && (s.item.attemptsUsed || 0) > 0;

              const icon = s.kind === 'lesson'
                ? (done ? 'bi-check-circle-fill text-success' : locked ? 'bi-lock text-muted' : 'bi-play-circle text-primary')
                : (s.item.passed ? 'bi-check-circle-fill text-success' : locked ? 'bi-lock text-muted' : 'bi-patch-question text-primary');

              const label = s.kind === 'lesson'
                ? `Lesson ${s.item.order}: ${s.item.title}`
                : `${s.final ? 'Final quiz' : 'Quiz'}: ${s.item.title}`;

              const meta = s.kind === 'lesson'
                ? <>{s.item.videoUrl && <><i className="bi bi-play-btn me-1" />Video · </>}{s.item.durationMinutes ? `${s.item.durationMinutes} min` : 'Reading'}{locked && <> · Locked</>}</>
                : <>{s.item.questionCount} questions{s.item.timeLimitMinutes ? ` · ${s.item.timeLimitMinutes} min` : ''} · attempts {s.item.attemptsUsed || 0}/{course.maxAttempts}{s.item.bestScore != null && <> · best {s.item.bestScore}%</>}{locked && <> · Locked</>}</>;

              const body = (
                <>
                  <span className="fs-5"><i className={`bi ${icon}`} /></span>
                  <div className="flex-grow-1 min-w-0">
                    <div className={`fw-semibold text-truncate ${locked ? 'text-muted' : ''}`}>{label}</div>
                    <div className="small text-muted">{meta}</div>
                  </div>
                  {s.kind === 'quiz' && s.item.passed && <StatusBadge status="passed" />}
                  {lockedOut && <span className="small text-danger text-nowrap"><i className="bi bi-lock me-1" />No attempts left</span>}
                </>
              );

              return locked || lockedOut ? (
                <ListGroup.Item key={`${s.kind}-${s.item._id}`} className="d-flex align-items-center gap-3 py-3 opacity-75" title={locked ? 'Finish the previous step to unlock' : undefined}>
                  {body}
                </ListGroup.Item>
              ) : (
                <ListGroup.Item key={`${s.kind}-${s.item._id}`} action as={Link} to={to} className="d-flex align-items-center gap-3 py-3">
                  {body}
                  <i className="bi bi-chevron-right text-muted" />
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
      </Card>
    </>
  );
}

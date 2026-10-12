/**
 * Agent → Course outline (/agent/courses/:id).
 * Progress header, lessons (with check marks), quizzes (best score + attempts) and the
 * certificate once every lesson is done and every quiz is passed.
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

// The next thing the agent should do: first unfinished lesson, then first unpassed quiz they can still take.
function nextStep(course) {
  const lesson = course.lessons.find((l) => !l.completed);
  if (lesson) return { to: `/agent/lessons/${lesson._id}`, label: `Continue: ${lesson.title}` };
  const quiz = course.quizzes.find((q) => !q.passed && q.attemptsUsed < course.maxAttempts);
  if (quiz) return { to: `/agent/quizzes/${quiz._id}`, label: `Take quiz: ${quiz.title}` };
  return null;
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
        action={
          <div className="d-flex gap-2 justify-content-center">
            <Button onClick={reload}>Retry</Button>
            {BACK}
          </div>
        }
      />
    );
  }

  const course = data.data;
  const progress = course.progress || { percent: 0, status: 'not_started', completedLessons: 0, totalLessons: 0, passedQuizzes: 0, totalQuizzes: 0 };
  const next = nextStep(course);

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
              <ProgressBar
                now={progress.percent}
                variant={progress.status === 'completed' ? 'success' : undefined}
                style={{ height: 10 }}
                aria-label="Course progress"
              />
              <p className="small text-muted mb-0 mt-3">{course.description}</p>
            </Col>
            <Col lg={4} className="text-lg-end">
              {next ? (
                <div className="d-grid d-lg-block">
                  <Button as={Link} to={next.to} className="text-truncate" style={{ maxWidth: '100%' }}>
                    {next.label} <i className="bi bi-arrow-right ms-1" />
                  </Button>
                </div>
              ) : progress.status === 'completed' ? (
                <span className="text-success fw-semibold"><i className="bi bi-check-circle-fill me-1" /> Course completed</span>
              ) : null}
              <div className="small text-muted mt-2">
                Pass mark {course.passingScore}% · {course.maxAttempts} attempts per quiz
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Certificate (issued automatically by the API when the course is completed) */}
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
              <Button as={Link} to="/agent/certificates" size="sm">
                <i className="bi bi-download me-1" /> Download PDF
              </Button>
              <Button as={Link} to={`/verify/${course.certificate.code}`} size="sm" variant="outline-primary" target="_blank" rel="noopener noreferrer">
                <i className="bi bi-patch-check me-1" /> Verify
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <Row className="g-3">
        {/* Lessons */}
        <Col lg={7}>
          <Card className="h-100">
            <Card.Header><i className="bi bi-file-text me-1" /> Lessons</Card.Header>
            {course.lessons.length === 0 ? (
              <Card.Body>
                <EmptyState icon="bi-file-text" title="No lessons yet" message="Your trainer hasn't added lessons to this course." />
              </Card.Body>
            ) : (
              <ListGroup variant="flush">
                {course.lessons.map((l, i) => (
                  <ListGroup.Item key={l._id} action as={Link} to={`/agent/lessons/${l._id}`} className="d-flex align-items-center gap-3 py-3">
                    <span className={`fs-5 ${l.completed ? 'text-success' : 'text-muted'}`} aria-label={l.completed ? 'Completed' : 'Not completed'}>
                      <i className={`bi ${l.completed ? 'bi-check-circle-fill' : 'bi-circle'}`} />
                    </span>
                    <div className="flex-grow-1 min-w-0">
                      <div className="fw-semibold text-truncate">{i + 1}. {l.title}</div>
                      <div className="small text-muted">
                        {l.videoUrl && <><i className="bi bi-play-btn me-1" />Video · </>}
                        {l.durationMinutes ? `${l.durationMinutes} min` : 'Reading'}
                      </div>
                    </div>
                    <i className="bi bi-chevron-right text-muted" />
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </Card>
        </Col>

        {/* Quizzes */}
        <Col lg={5}>
          <Card className="h-100">
            <Card.Header><i className="bi bi-patch-question me-1" /> Quizzes</Card.Header>
            {course.quizzes.length === 0 ? (
              <Card.Body>
                <EmptyState icon="bi-patch-question" title="No quizzes yet" message="Your trainer hasn't added quizzes to this course." />
              </Card.Body>
            ) : (
              <ListGroup variant="flush">
                {course.quizzes.map((q) => {
                  const attemptsLeft = Math.max(course.maxAttempts - q.attemptsUsed, 0);
                  const lockedOut = !q.passed && attemptsLeft === 0;
                  return (
                    <ListGroup.Item key={q._id} className="py-3">
                      <div className="d-flex align-items-start gap-2 mb-1">
                        <div className="fw-semibold flex-grow-1">{q.title}</div>
                        {q.passed ? (
                          <StatusBadge status="passed" />
                        ) : q.attemptsUsed > 0 ? (
                          <StatusBadge status="failed" label={lockedOut ? 'Failed' : 'Not passed yet'} />
                        ) : null}
                      </div>
                      <div className="small text-muted mb-2">
                        {q.questionCount} questions
                        {q.timeLimitMinutes ? ` · ${q.timeLimitMinutes} min` : ''}
                        {' · '}attempts {q.attemptsUsed}/{course.maxAttempts}
                        {q.bestScore != null && <> · best <span className="fw-semibold">{q.bestScore}%</span></>}
                      </div>
                      {lockedOut ? (
                        <div className="small text-danger">
                          <i className="bi bi-lock me-1" /> No attempts left. Talk to your trainer.
                        </div>
                      ) : q.passed ? (
                        <Button as={Link} to={`/agent/quizzes/${q._id}`} size="sm" variant="outline-primary">
                          View results
                        </Button>
                      ) : (
                        <Button as={Link} to={`/agent/quizzes/${q._id}`} size="sm">
                          {q.attemptsUsed > 0 ? `Retake (${attemptsLeft} left)` : 'Start quiz'}
                        </Button>
                      )}
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}

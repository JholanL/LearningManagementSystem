import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';
import Row from 'react-bootstrap/Row';
import { Link, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingBlock from '../../components/LoadingBlock';
import { downloadSubmissionFile } from '../../utils/downloadFile';
import { formatDateTime, formatFileSize, getInitials } from '../../utils/format';

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'ungraded', label: 'To grade', test: (item) => item.grade === null },
  { key: 'graded', label: 'Graded', test: (item) => item.grade !== null },
  { key: 'late', label: 'Late', test: (item) => item.late },
];

// The student uploaded again after being asked to resubmit.
const isResubmitted = (submission) =>
  submission.returnedAt && new Date(submission.submittedAt) > new Date(submission.returnedAt);

function GradePanel({ submission, points, onUpdated }) {
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmReturn, setConfirmReturn] = useState(false);

  // Reset the form whenever another submission is picked.
  useEffect(() => {
    setGrade(submission.grade === null ? '' : String(submission.grade));
    setFeedback(submission.feedback || '');
    setError('');
    setMessage('');
  }, [submission.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      await downloadSubmissionFile(submission);
    } catch {
      setError('Could not download the file. It may have been removed.');
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const value = Number(grade);
    if (grade === '' || !Number.isFinite(value) || value < 0 || value > points) {
      setError(`Enter a grade from 0 to ${points}`);
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put(`/submissions/${submission.id}/grade`, {
        grade: value,
        feedback: feedback.trim(),
      });
      setMessage('Grade saved.');
      onUpdated(data.submission);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    // The grade route needs a grade, so new feedback is kept only for graded work.
    if (feedback.trim() !== (submission.feedback || '') && submission.grade !== null) {
      await api.put(`/submissions/${submission.id}/grade`, {
        grade: submission.grade,
        feedback: feedback.trim(),
      });
    }
    const { data } = await api.post(`/submissions/${submission.id}/return`);
    setGrade('');
    setMessage('The student can now upload a new file.');
    onUpdated(data.submission);
  };

  const waitingForResubmission = submission.returnedAt && !isResubmitted(submission);

  return (
    <div className="lms-card p-4">
      <div className="d-flex align-items-center gap-3 mb-3">
        <span className="lms-avatar" style={{ width: 44, height: 44 }}>
          {getInitials(submission.student.name)}
        </span>
        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          <div className="fw-bold fs-5 text-truncate">{submission.student.name}</div>
          <div className="small text-body-secondary">
            Submitted {formatDateTime(submission.submittedAt)}
            {submission.late && <span className="lms-pill lms-pill--danger ms-2">Late</span>}
          </div>
        </div>
      </div>

      {waitingForResubmission && (
        <Alert variant="warning" className="py-2 small">
          You asked for a new file on {formatDateTime(submission.returnedAt)}. The file below is
          the earlier one.
        </Alert>
      )}
      {isResubmitted(submission) && (
        <Alert variant="info" className="py-2 small">
          Resubmitted after you asked for changes on {formatDateTime(submission.returnedAt)}.
        </Alert>
      )}

      <div className="rounded-3 p-3 mb-3" style={{ background: 'var(--lms-ground)' }}>
        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-file-earmark-text fs-3" style={{ color: 'var(--lms-primary)' }} aria-hidden="true" />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate">{submission.file.name}</div>
            <div className="small text-body-secondary">{formatFileSize(submission.file.size)}</div>
          </div>
          <Button variant="outline-primary" onClick={handleDownload} disabled={downloading}>
            <i className="bi bi-download me-2" aria-hidden="true" />
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
        </div>
        {submission.comment && (
          <p className="small mb-0 mt-3" style={{ whiteSpace: 'pre-line' }}>
            <span className="fw-semibold">Student's note: </span>
            {submission.comment}
          </p>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}

      <Form noValidate onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="grade-score">
          <Form.Label>Grade</Form.Label>
          <div className="d-flex align-items-center gap-2">
            <Form.Control
              type="number"
              min={0}
              max={points}
              step="any"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              style={{ maxWidth: 130 }}
            />
            <span className="text-body-secondary">out of {points}</span>
          </div>
        </Form.Group>
        <Form.Group className="mb-3" controlId="grade-feedback">
          <Form.Label>Feedback (optional)</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            maxLength={2000}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </Form.Group>
        <div className="d-flex flex-wrap gap-2">
          <Button type="submit" className="flex-grow-1" disabled={saving}>
            {saving ? 'Saving…' : submission.grade === null ? 'Save grade' : 'Update grade'}
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => setConfirmReturn(true)}
            disabled={saving || waitingForResubmission}
          >
            Ask to resubmit
          </Button>
        </div>
      </Form>

      <ConfirmModal
        show={confirmReturn}
        title="Ask for a new file?"
        confirmLabel="Ask to resubmit"
        variant="primary"
        onConfirm={handleReturn}
        onHide={() => setConfirmReturn(false)}
      >
        <p className="mb-0">
          {submission.student.name} will be able to upload again. Any grade on this submission is
          cleared; your feedback stays so they know what to fix.
        </p>
      </ConfirmModal>
    </div>
  );
}

export default function AssignmentSubmissions() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState(null);
  const [course, setCourse] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: assignmentData } = await api.get(`/assignments/${id}`);
        const courseId = assignmentData.assignment.course;
        const [courseRes, submissionsRes, studentsRes] = await Promise.all([
          api.get(`/courses/${courseId}`),
          api.get(`/assignments/${id}/submissions`),
          api.get(`/courses/${courseId}/students`),
        ]);
        if (ignore) return;

        const list = submissionsRes.data.data;
        setAssignment(assignmentData.assignment);
        setCourse(courseRes.data.course);
        setSubmissions(list);
        setStudents(studentsRes.data.data);
        // Start with the first submission that still needs a grade.
        const firstUngraded = list.find((item) => item.grade === null);
        setSelectedId((firstUngraded || list[0])?.id ?? null);
        setError('');
      } catch (err) {
        if (!ignore) setError(getErrorMessage(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleUpdated = (updated) => {
    setSubmissions((list) =>
      list.map((item) => (item.id === updated.id ? { ...item, ...updated, student: item.student } : item))
    );
  };

  if (loading) return <LoadingBlock />;

  if (!assignment) {
    return (
      <div className="lms-card text-center p-5">
        <h1 className="fs-4 fw-bold">Assignment not available</h1>
        <p className="text-body-secondary">{error}</p>
        <Link to="/instructor" className="btn btn-primary">
          Back to my courses
        </Link>
      </div>
    );
  }

  const activeFilter = FILTERS.find((item) => item.key === filter);
  const visible = submissions.filter(activeFilter.test);
  const selected = submissions.find((item) => item.id === selectedId);
  const ungraded = submissions.filter((item) => item.grade === null).length;
  const submittedIds = new Set(submissions.map((item) => String(item.student.id)));
  const notSubmitted = students.filter((student) => !submittedIds.has(String(student.id)));

  return (
    <>
      <div className="small mb-2">
        <Link to="/instructor" className="fw-semibold">
          My Courses
        </Link>{' '}
        /{' '}
        <Link to={`/instructor/courses/${course.id}?tab=assignments`} className="fw-semibold">
          {course.title}
        </Link>{' '}
        / Submissions
      </div>
      <h1 className="font-display fs-2 mb-1">{assignment.title}</h1>
      <p className="text-body-secondary mb-4">
        {assignment.dueDate ? `Due ${formatDateTime(assignment.dueDate)}` : 'No due date'} ·{' '}
        {assignment.points} points · {submissions.length} of {students.length} submitted ·{' '}
        {ungraded} waiting for a grade
      </p>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-4 align-items-start">
        <Col lg={7} className="d-flex flex-column gap-4">
          <div>
            <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter submissions">
              {FILTERS.map((item) => {
                const count = submissions.filter(item.test).length;
                return (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={filter === item.key ? 'primary' : 'outline-primary'}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label} ({count})
                  </Button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <div className="lms-card text-center p-5">
                <h2 className="fs-5 fw-bold">
                  {submissions.length === 0 ? 'No submissions yet' : 'Nothing in this filter'}
                </h2>
                <p className="text-body-secondary mb-0">
                  {submissions.length === 0
                    ? 'Files students upload for this assignment will show up here.'
                    : 'Pick another filter to see the rest.'}
                </p>
              </div>
            ) : (
              <ListGroup className="lms-card overflow-hidden">
                {visible.map((item) => (
                  <ListGroup.Item
                    key={item.id}
                    action
                    active={item.id === selectedId}
                    onClick={() => setSelectedId(item.id)}
                    className="d-flex align-items-center gap-3 py-3"
                  >
                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                      <div className="fw-semibold text-truncate">{item.student.name}</div>
                      <div className="small text-body-secondary">
                        {formatDateTime(item.submittedAt)}
                        {item.late && ' · Late'}
                        {isResubmitted(item) && ' · Resubmitted'}
                      </div>
                    </div>
                    {item.grade !== null ? (
                      <span className="lms-pill">
                        {item.grade} / {assignment.points}
                      </span>
                    ) : item.returnedAt && !isResubmitted(item) ? (
                      <span className="lms-pill lms-pill--gray">Returned</span>
                    ) : (
                      <span className="lms-pill lms-pill--amber">To grade</span>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}
          </div>

          {notSubmitted.length > 0 && (
            <div className="lms-card p-3 p-md-4">
              <h2 className="fs-6 fw-bold mb-2">Not submitted ({notSubmitted.length})</h2>
              {notSubmitted.map((student) => (
                <div key={student.id} className="d-flex align-items-center gap-2 py-2 border-top">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">{student.name}</div>
                    <div className="small text-body-secondary">{student.email}</div>
                  </div>
                  {assignment.dueDate && new Date(assignment.dueDate) < new Date() && (
                    <span className="lms-pill lms-pill--danger">Missing</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Col>
        <Col lg={5}>
          {selected ? (
            <GradePanel submission={selected} points={assignment.points} onUpdated={handleUpdated} />
          ) : (
            <div className="lms-card p-4 text-body-secondary">Pick a submission to grade it.</div>
          )}
        </Col>
      </Row>
    </>
  );
}

import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingBlock from '../../components/LoadingBlock';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { formatDate } from '../../utils/format';
import CourseForm from './components/CourseForm';

const PAGE_SIZE = 8;

function StatCard({ label, value, amber, children }) {
  return (
    <div className={`lms-card lms-stat ${amber ? 'lms-stat--amber' : ''}`}>
      <div className="lms-stat__label">{label}</div>
      <div className="lms-stat__value">{value ?? '–'}</div>
      {children}
    </div>
  );
}

export default function MyCourses() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [courses, setCourses] = useState([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    api
      .get('/courses', {
        params: {
          mine: true,
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: status || undefined,
        },
      })
      .then(({ data }) => {
        if (ignore) return;
        setCourses(data.data);
        setMeta({ total: data.total, totalPages: data.totalPages });
        setError('');
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, status, reloadKey]);

  useEffect(() => {
    let ignore = false;
    api
      .get('/courses/summary')
      .then(({ data }) => {
        if (!ignore) setSummary(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  // A new course opens straight in its manage page so lessons can be added next.
  const handleCreate = async (values) => {
    const { data } = await api.post('/courses', values);
    navigate(`/instructor/courses/${data.course.id}`);
  };

  const handleDelete = async () => {
    await api.delete(`/courses/${toDelete.id}`);
    // Step back a page if the last course on this page was deleted.
    if (courses.length === 1 && page > 1) setPage(page - 1);
    setReloadKey((key) => key + 1);
  };

  const isFiltered = Boolean(debouncedSearch || status);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, meta.total);

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
        <h1 className="font-display fs-2 mb-0 me-auto">My courses</h1>
        <Button onClick={() => setShowCreate(true)} className="d-inline-flex align-items-center gap-2">
          <i className="bi bi-plus-lg" aria-hidden="true" />
          New course
        </Button>
      </div>

      <Row className="g-3 mb-4">
        <Col sm={4}>
          <StatCard label="Courses" value={summary?.courseCount}>
            {summary && (
              <div className="small text-body-secondary">{summary.publishedCount} published</div>
            )}
          </StatCard>
        </Col>
        <Col sm={4}>
          <StatCard label="Enrolled students" value={summary?.studentCount} />
        </Col>
        <Col sm={4}>
          <StatCard label="Submissions to grade" value={summary?.ungradedCount} amber />
        </Col>
      </Row>

      {summary?.toGrade.length > 0 && (
        <div className="lms-card p-3 p-md-4 mb-4">
          <h2 className="fs-6 fw-bold mb-2">Waiting for a grade</h2>
          {summary.toGrade.map((item) => (
            <Link
              key={item.assignmentId}
              to={`/instructor/assignments/${item.assignmentId}`}
              className="d-flex align-items-center gap-3 py-2 border-top text-reset text-decoration-none"
            >
              <div className="flex-grow-1">
                <div className="fw-semibold">{item.assignmentTitle}</div>
                <div className="small text-body-secondary">{item.courseTitle}</div>
              </div>
              <span className="lms-pill lms-pill--amber">{item.count} to grade</span>
            </Link>
          ))}
        </div>
      )}

      <div className="lms-card">
        <div className="d-flex flex-wrap gap-2 p-3">
          <Form.Control
            type="search"
            placeholder="Search my courses"
            aria-label="Search my courses"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            style={{ maxWidth: 340 }}
          />
          <Form.Select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="ms-sm-auto"
            style={{ maxWidth: 180 }}
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </Form.Select>
        </div>

        {error && (
          <Alert variant="danger" className="mx-3">
            {error}
          </Alert>
        )}

        {loading ? (
          <LoadingBlock />
        ) : courses.length === 0 ? (
          <div className="text-center px-3 py-5 border-top">
            <h2 className="fs-5 fw-bold">{isFiltered ? 'No matching courses' : 'No courses yet'}</h2>
            <p className="text-body-secondary mb-3">
              {isFiltered
                ? 'Try a different search or status.'
                : 'Create your first course, then add lessons and share the enroll code.'}
            </p>
            {!isFiltered && <Button onClick={() => setShowCreate(true)}>Create a course</Button>}
          </div>
        ) : (
          <Table responsive className="lms-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Students</th>
                <th>Lessons</th>
                <th>Status</th>
                <th>Updated</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td style={{ minWidth: 240 }}>
                    <Link
                      to={`/instructor/courses/${course.id}`}
                      className="fw-bold text-reset text-decoration-none"
                    >
                      {course.title}
                    </Link>
                    <div className="small text-body-secondary">
                      {[course.code, course.category].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td>{course.studentCount}</td>
                  <td>{course.lessonCount}</td>
                  <td>
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="text-body-secondary text-nowrap">{formatDate(course.updatedAt)}</td>
                  <td className="text-end text-nowrap">
                    <Link
                      to={`/instructor/courses/${course.id}`}
                      className="lms-icon-action"
                      aria-label={`Manage ${course.title}`}
                      title="Manage"
                    >
                      <i className="bi bi-pencil-square" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="lms-icon-action lms-icon-action--danger"
                      aria-label={`Delete ${course.title}`}
                      title="Delete"
                      onClick={() => setToDelete(course)}
                    >
                      <i className="bi bi-trash3" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && meta.total > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-3 p-3 border-top">
            <div className="small text-body-secondary me-auto">
              Showing {first} to {last} of {meta.total} courses
            </div>
            <Pagination page={page} totalPages={meta.totalPages} onChange={setPage} />
          </div>
        )}
      </div>

      <Modal show={showCreate} onHide={() => setShowCreate(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 fw-bold">New course</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-body-secondary">
            After saving, you can add lessons and assignments. Students join with the enroll code
            once the course is published.
          </p>
          {/* A fresh form every time the modal opens. */}
          {showCreate && (
            <CourseForm
              submitLabel="Create course"
              onSubmit={handleCreate}
              onCancel={() => setShowCreate(false)}
            />
          )}
        </Modal.Body>
      </Modal>

      <ConfirmModal
        show={Boolean(toDelete)}
        title="Delete this course?"
        confirmLabel="Delete course"
        onConfirm={handleDelete}
        onHide={() => setToDelete(null)}
      >
        <p className="mb-0">
          <strong>{toDelete?.title}</strong> will be removed together with its lessons,
          assignments, announcements, enrollments, and every uploaded file. This cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

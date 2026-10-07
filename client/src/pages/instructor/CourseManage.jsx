import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Nav from 'react-bootstrap/Nav';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../api/axios';
import ConfirmModal from '../../components/ConfirmModal';
import LoadingBlock from '../../components/LoadingBlock';
import StatusBadge from '../../components/StatusBadge';
import AnnouncementsTab from './components/AnnouncementsTab';
import AssignmentsTab from './components/AssignmentsTab';
import CourseForm from './components/CourseForm';
import EnrollCodeCard from './components/EnrollCodeCard';
import GradebookTab from './components/GradebookTab';
import LessonsTab from './components/LessonsTab';
import StudentsTab from './components/StudentsTab';

const TABS = [
  { key: 'lessons', label: 'Lessons' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'students', label: 'Students' },
  { key: 'gradebook', label: 'Gradebook' },
  { key: 'settings', label: 'Settings' },
];

export default function CourseManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The open tab lives in the URL (?tab=assignments) so links and Back keep it.
  const requested = searchParams.get('tab');
  const tab = TABS.some((item) => item.key === requested) ? requested : 'lessons';

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api
      .get(`/courses/${id}`)
      .then(({ data }) => {
        if (!ignore) {
          setCourse(data.course);
          setError('');
        }
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
  }, [id]);

  const updateCourse = async (changes) => {
    const { data } = await api.put(`/courses/${id}`, changes);
    setCourse((current) => ({ ...current, ...data.course }));
  };

  const togglePublished = async () => {
    setToggling(true);
    setError('');
    try {
      await updateCourse({ status: course.status === 'published' ? 'draft' : 'published' });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setToggling(false);
    }
  };

  const regenerateCode = async () => {
    const { data } = await api.post(`/courses/${id}/enroll-code`);
    setCourse((current) => ({ ...current, enrollCode: data.enrollCode }));
  };

  const deleteCourse = async () => {
    await api.delete(`/courses/${id}`);
    navigate('/instructor', { replace: true });
  };

  const handleStudentCount = useCallback(
    (count) => setCourse((current) => (current ? { ...current, studentCount: count } : current)),
    []
  );

  if (loading) return <LoadingBlock />;

  if (!course) {
    return (
      <div className="lms-card text-center p-5">
        <h1 className="fs-4 fw-bold">Course not available</h1>
        <p className="text-body-secondary">{error || 'This course could not be loaded.'}</p>
        <Link to="/instructor" className="btn btn-primary">
          Back to my courses
        </Link>
      </div>
    );
  }

  const isPublished = course.status === 'published';

  return (
    <>
      <div className="small mb-2">
        <Link to="/instructor" className="fw-semibold">
          My Courses
        </Link>{' '}
        / {course.title}
      </div>

      <div className="d-flex flex-wrap align-items-start gap-3 mb-3">
        <div className="me-auto" style={{ minWidth: 0 }}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h1 className="font-display fs-2 mb-0">{course.title}</h1>
            <StatusBadge status={course.status} />
          </div>
          <div className="text-body-secondary small">
            {[course.code, course.category, `${course.studentCount} students`, `${course.lessonCount} lessons`]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <Button
          variant={isPublished ? 'outline-primary' : 'primary'}
          onClick={togglePublished}
          disabled={toggling}
        >
          {toggling ? 'Saving…' : isPublished ? 'Move to draft' : 'Publish course'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="mb-4">
        <EnrollCodeCard
          code={course.enrollCode}
          isPublished={isPublished}
          onRegenerate={regenerateCode}
        />
      </div>

      <Nav variant="underline" className="mb-4 flex-nowrap overflow-auto" role="tablist">
        {TABS.map((item) => (
          <Nav.Item key={item.key}>
            <Nav.Link
              as="button"
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              active={tab === item.key}
              onClick={() => setSearchParams({ tab: item.key }, { replace: true })}
            >
              {item.label}
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {tab === 'lessons' && <LessonsTab courseId={id} />}
      {tab === 'assignments' && <AssignmentsTab courseId={id} />}
      {tab === 'announcements' && <AnnouncementsTab courseId={id} />}
      {tab === 'students' && <StudentsTab courseId={id} onCountChange={handleStudentCount} />}
      {tab === 'gradebook' && <GradebookTab courseId={id} courseTitle={course.title} />}
      {tab === 'settings' && (
        <>
          <div className="lms-card p-4 mb-4" style={{ maxWidth: 820 }}>
            <h2 className="fs-5 fw-bold mb-3">Course details</h2>
            {/* Re-mount when the header button changes the status so the form shows it. */}
            <CourseForm
              key={course.status}
              initialValues={{
                title: course.title,
                code: course.code,
                category: course.category,
                description: course.description,
                status: course.status,
              }}
              submitLabel="Save changes"
              savedText="Changes saved."
              onSubmit={updateCourse}
            />
          </div>

          <div
            className="lms-card d-flex flex-wrap align-items-center gap-3 p-4"
            style={{ maxWidth: 820, borderColor: '#f1c6c2' }}
          >
            <div className="me-auto">
              <h2 className="fs-6 fw-bold mb-1">Delete course</h2>
              <p className="small text-body-secondary mb-0">
                Removes its lessons, assignments, announcements, enrollments, and uploaded files.
              </p>
            </div>
            <Button variant="outline-danger" onClick={() => setConfirmDelete(true)}>
              Delete course
            </Button>
          </div>
        </>
      )}

      <ConfirmModal
        show={confirmDelete}
        title="Delete this course?"
        confirmLabel="Delete course"
        onConfirm={deleteCourse}
        onHide={() => setConfirmDelete(false)}
      >
        <p className="mb-0">
          <strong>{course.title}</strong> will be removed together with everything in it. This
          cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

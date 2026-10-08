/**
 * Course Builder (/trainer/courses/:id, also used by admin).
 * NOTE: the lessons/quizzes editor is still in the trainer build order (#2).
 * This tabbed shell adds the real "Analytics" tab (feature 3) now; the "Builder"
 * tab lists what still needs building so that work isn't lost.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge, Card, Nav } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import CourseAnalytics from '../../components/CourseAnalytics';
import useFetch from '../../hooks/useFetch';
import { coursesApi } from '../../api/services';

const TODO = [
  'Course info header with Publish toggle',
  'Lessons list sorted by order: add / edit / delete (title, content, YouTube URL, order, minutes)',
  'Quizzes list: add / edit / delete → opens Quiz Builder',
  'Preview lesson content',
];

export default function CourseBuilder() {
  const { id } = useParams();
  const [tab, setTab] = useState('builder');
  const { data, loading, error } = useFetch(() => coursesApi.get(id), [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load course" message={error} />;
  const course = data.data;

  return (
    <>
      <PageHeader
        title={`${course.code} · ${course.title}`}
        icon="bi-tools"
        subtitle={course.category}
        actions={<Badge bg={course.isPublished ? 'success' : 'secondary'}>{course.isPublished ? 'Published' : 'Draft'}</Badge>}
      />

      <Nav variant="tabs" activeKey={tab} onSelect={(k) => setTab(k)} className="mb-3">
        <Nav.Item><Nav.Link eventKey="builder">Builder</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="analytics">Analytics</Nav.Link></Nav.Item>
      </Nav>

      {tab === 'analytics' ? (
        <CourseAnalytics courseId={id} />
      ) : (
        <Card className="todo-card">
          <Card.Body>
            <h2 className="h6"><i className="bi bi-cone-striped me-2" />Lessons &amp; quizzes editor — to build</h2>
            <p className="text-muted small">This course has {course.lessons?.length || 0} lesson(s) and {course.quizzes?.length || 0} quiz(zes). The editor UI is part of the trainer build order:</p>
            <ul className="small">
              {TODO.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <p className="small text-muted mb-0">Meanwhile, open the <strong>Analytics</strong> tab to see how agents are performing on this course.</p>
          </Card.Body>
        </Card>
      )}
    </>
  );
}

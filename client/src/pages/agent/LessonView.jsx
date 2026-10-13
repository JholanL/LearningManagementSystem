/**
 * Agent → Lesson (/agent/lessons/:id): read/watch, "Mark as complete", prev/next navigation.
 * Completing the last item of a course issues the certificate (handled by the API).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Ratio, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ArticleBody from '../../components/ArticleBody';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { lessonsApi } from '../../api/services';
import { getErrorMessage, toYouTubeEmbed } from '../../utils/helpers';

export default function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => lessonsApi.get(id), [id]);

  // Lessons completed during this visit (keyed by id so it resets when moving to the next lesson)
  const [justCompleted, setJustCompleted] = useState({});
  const [saving, setSaving] = useState(false);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="bi-file-earmark-x"
        title="Lesson not available"
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

  const lesson = data.data;
  const courseUrl = `/agent/courses/${lesson.course}`;
  const completed = lesson.completed || justCompleted[lesson._id];
  const embedUrl = toYouTubeEmbed(lesson.videoUrl);

  const markComplete = async () => {
    setSaving(true);
    try {
      const res = await lessonsApi.complete(lesson._id);
      setJustCompleted((c) => ({ ...c, [lesson._id]: true }));
      if (res.data.certificate) {
        toast.success('Course completed! Your certificate has been issued.');
        navigate(courseUrl);
      } else {
        toast.success(`Lesson complete · course progress ${res.data.percent}%`);
        // Last lesson → back to the outline, where the quiz is waiting
        navigate(lesson.nextLesson ? `/agent/lessons/${lesson.nextLesson._id}` : courseUrl);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={lesson.title}
        icon="bi-play-btn"
        subtitle={`${lesson.courseTitle} · Lesson ${lesson.order}${lesson.durationMinutes ? ` · ${lesson.durationMinutes} min` : ''}`}
        actions={
          <Button variant="light" as={Link} to={courseUrl}>
            <i className="bi bi-arrow-left me-1" /> Course outline
          </Button>
        }
      />

      {lesson.videoUrl && (
        <Card className="mb-3 overflow-hidden">
          {embedUrl ? (
            <Ratio aspectRatio="16x9">
              <iframe
                src={embedUrl}
                title={lesson.title}
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 0 }}
              />
            </Ratio>
          ) : (
            // Not a YouTube link: don't embed an unknown site, just link to it
            <Card.Body>
              <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">
                <i className="bi bi-box-arrow-up-right me-1" /> Open the lesson video
              </a>
            </Card.Body>
          )}
        </Card>
      )}

      <Card className="mb-3">
        <Card.Body>
          {lesson.content ? <ArticleBody text={lesson.content} /> : <p className="text-muted mb-0">This lesson has no written content.</p>}
        </Card.Body>
      </Card>

      {/* Completion + navigation */}
      <Card>
        <Card.Body className="d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2">
          <div className="d-flex gap-2 order-2 order-md-1">
            <Button
              variant="light"
              as={Link}
              to={lesson.prevLesson ? `/agent/lessons/${lesson.prevLesson._id}` : '#'}
              disabled={!lesson.prevLesson}
              className="flex-fill"
              title={lesson.prevLesson?.title}
            >
              <i className="bi bi-chevron-left" /> Previous
            </Button>
            <Button
              variant="light"
              as={Link}
              to={lesson.nextLesson ? `/agent/lessons/${lesson.nextLesson._id}` : '#'}
              disabled={!lesson.nextLesson}
              className="flex-fill"
              title={lesson.nextLesson?.title}
            >
              Next <i className="bi bi-chevron-right" />
            </Button>
          </div>

          <div className="ms-md-auto order-1 order-md-2 d-grid">
            {completed ? (
              <span className="text-success fw-semibold text-center py-2">
                <i className="bi bi-check-circle-fill me-1" /> Completed
              </span>
            ) : (
              <Button variant="success" onClick={markComplete} disabled={saving}>
                {saving ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-check2-circle me-1" />}
                Mark as complete
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </>
  );
}

/**
 * Agent → Lesson (/agent/lessons/:id): read section-by-section, then complete.
 *
 * Gate to complete: the agent must step through every section to the end (no timer).
 * Sequential path: after completing a lesson, its quiz appears (if the trainer set one);
 * the NEXT lesson stays locked until that quiz is passed. The API enforces the same
 * order, so nothing can be skipped via the URL.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Ratio, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import Markdown from '../../components/Markdown';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { lessonsApi } from '../../api/services';
import { getErrorMessage, toYouTubeEmbed } from '../../utils/helpers';
import { splitSections } from '../../utils/lessonSections';

export default function LessonView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => lessonsApi.get(id), [id]);

  const [justCompleted, setJustCompleted] = useState({});
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState(0);
  const [maxSection, setMaxSection] = useState(0);
  const [scrolledEnd, setScrolledEnd] = useState(false); // single-section lessons

  const lesson = data?.data;
  const alreadyDone = !!(lesson && (lesson.completed || justCompleted[lesson._id]));
  const sections = useMemo(() => (lesson ? splitSections(lesson.content) : []), [lesson]);
  const single = sections.length <= 1;

  // Reset the reader when the lesson changes.
  useEffect(() => {
    if (!lesson) return;
    setSection(0);
    setMaxSection(0);
    setScrolledEnd(false);
    window.scrollTo({ top: 0 });
  }, [lesson]);

  // Single-section lessons: unlock once the agent scrolls to the end.
  useEffect(() => {
    if (!lesson || alreadyDone || !single) return undefined;
    const check = () => {
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 120) setScrolledEnd(true);
    };
    const t = setTimeout(check, 300);
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { clearTimeout(t); window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [lesson, alreadyDone, single]);

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="bi-lock"
        title="Lesson locked or unavailable"
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

  const courseUrl = `/agent/courses/${lesson.course}`;
  const embedUrl = toYouTubeEmbed(lesson.videoUrl);
  const readEnd = single ? scrolledEnd : maxSection >= sections.length - 1;
  const canComplete = readEnd;
  const pendingQuiz = lesson.lessonQuiz && !lesson.lessonQuiz.passed; // quiz to take before the next lesson
  const nextLessonUnlocked = alreadyDone && !pendingQuiz;

  const goSection = (idx) => {
    const clamped = Math.max(0, Math.min(idx, sections.length - 1));
    setSection(clamped);
    setMaxSection((m) => Math.max(m, clamped));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goNext = (next) => {
    if (next?.type === 'quiz') navigate(`/agent/quizzes/${next.id}`);
    else if (next?.type === 'lesson') navigate(`/agent/lessons/${next.id}`);
    else navigate(courseUrl);
  };

  const markComplete = async () => {
    setSaving(true);
    try {
      const res = await lessonsApi.complete(lesson._id);
      setJustCompleted((c) => ({ ...c, [lesson._id]: true }));
      if (res.data.certificate) {
        toast.success('Course completed! Your certificate has been issued.');
        navigate(courseUrl);
        return;
      }
      if (res.data.next?.type === 'quiz') toast.success('Lesson done — now take the quiz to continue.');
      else toast.success(`Lesson complete · course progress ${res.data.percent}%`);
      goNext(res.data.next);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const cur = sections[section] || { heading: '', content: '' };

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
            <Card.Body>
              <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer">
                <i className="bi bi-box-arrow-up-right me-1" /> Open the lesson video
              </a>
            </Card.Body>
          )}
        </Card>
      )}

      {/* Section content */}
      <Card className="mb-3">
        <Card.Body>
          {!lesson.content ? (
            <p className="text-muted mb-0">This lesson has no written content.</p>
          ) : (
            <>
              {!single && (
                <div className="text-muted small text-uppercase fw-semibold mb-1" style={{ letterSpacing: '.03em' }}>
                  Section {section + 1} of {sections.length}
                </div>
              )}
              {cur.heading && <h2 className="h4 fw-semibold mb-3">{cur.heading}</h2>}
              <Markdown text={cur.content} />

              {!single && (
                <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                  <Button variant="light" onClick={() => goSection(section - 1)} disabled={section === 0}>
                    <i className="bi bi-chevron-left me-1" />Previous section
                  </Button>
                  {section < sections.length - 1 ? (
                    <Button onClick={() => goSection(section + 1)}>
                      Next section<i className="bi bi-chevron-right ms-1" />
                    </Button>
                  ) : (
                    <span className="small text-success fw-semibold"><i className="bi bi-check-circle-fill me-1" />Last section</span>
                  )}
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Quiz call-to-action: completed, but its quiz still needs passing */}
      {alreadyDone && pendingQuiz && (
        <Card className="mb-3 border-primary">
          <Card.Body className="d-flex flex-wrap align-items-center gap-2">
            <div className="flex-grow-1">
              <div className="fw-semibold"><i className="bi bi-patch-question me-1" />Quiz: {lesson.lessonQuiz.title}</div>
              <div className="small text-muted">Pass this quiz to unlock the next lesson.</div>
            </div>
            <Button as={Link} to={`/agent/quizzes/${lesson.lessonQuiz._id}`}>Take the quiz <i className="bi bi-arrow-right ms-1" /></Button>
          </Card.Body>
        </Card>
      )}

      {/* Completion + lesson navigation */}
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
              <i className="bi bi-chevron-left" /> Prev lesson
            </Button>
            <Button
              variant="light"
              as={Link}
              to={nextLessonUnlocked && lesson.nextLesson ? `/agent/lessons/${lesson.nextLesson._id}` : '#'}
              disabled={!lesson.nextLesson || !nextLessonUnlocked}
              className="flex-fill"
              title={!nextLessonUnlocked ? (pendingQuiz ? 'Pass this lesson’s quiz first' : 'Complete this lesson first') : lesson.nextLesson?.title}
            >
              {!nextLessonUnlocked && lesson.nextLesson && <i className="bi bi-lock me-1" />}
              Next lesson <i className="bi bi-chevron-right" />
            </Button>
          </div>

          <div className="ms-md-auto order-1 order-md-2 d-grid" style={{ minWidth: 230 }}>
            {alreadyDone ? (
              pendingQuiz ? (
                <Button as={Link} to={`/agent/quizzes/${lesson.lessonQuiz._id}`}>
                  <i className="bi bi-patch-question me-1" />Take the quiz
                </Button>
              ) : (
                <span className="text-success fw-semibold text-center py-2">
                  <i className="bi bi-check-circle-fill me-1" /> Completed
                </span>
              )
            ) : canComplete ? (
              <Button variant="success" onClick={markComplete} disabled={saving}>
                {saving ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-check2-circle me-1" />}
                Mark as complete
              </Button>
            ) : (
              <Button variant="success" disabled title="Read to the end to unlock">
                <i className="bi bi-lock me-1" />
                {single ? 'Scroll to the end' : 'Reach the last section'}
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </>
  );
}

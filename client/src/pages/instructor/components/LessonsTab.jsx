import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import api, { getErrorMessage } from '../../../api/axios';
import ConfirmModal from '../../../components/ConfirmModal';
import LoadingBlock from '../../../components/LoadingBlock';
import LessonModal from './LessonModal';

export default function LessonsTab({ courseId }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState(false);
  const [editor, setEditor] = useState({ show: false, lessonId: null });
  const [toDelete, setToDelete] = useState(null);

  const loadLessons = useCallback(async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}/lessons`);
      setLessons(data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  // Swap two lessons, then renumber every lesson whose position changed.
  const move = async (index, direction) => {
    const reordered = [...lessons];
    const target = index + direction;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    setMoving(true);
    setLessons(reordered);
    try {
      await Promise.all(
        reordered
          .map((lesson, position) => ({ lesson, order: position + 1 }))
          .filter(({ lesson, order }) => lesson.order !== order)
          .map(({ lesson, order }) => api.put(`/lessons/${lesson.id}`, { order }))
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      await loadLessons();
      setMoving(false);
    }
  };

  const handleDelete = async () => {
    await api.delete(`/lessons/${toDelete.id}`);
    await loadLessons();
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <p className="text-body-secondary mb-0 me-auto">
          Students see lessons in this order and can mark each one as complete.
        </p>
        <Button onClick={() => setEditor({ show: true, lessonId: null })}>
          <i className="bi bi-plus-lg me-2" aria-hidden="true" />
          Add lesson
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {lessons.length === 0 ? (
        <div className="lms-card text-center p-5">
          <h2 className="fs-5 fw-bold">No lessons yet</h2>
          <p className="text-body-secondary mb-0">Add the first lesson for this course.</p>
        </div>
      ) : (
        <div className="lms-card">
          {lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className={`d-flex align-items-center gap-3 px-3 py-2 ${index ? 'border-top' : ''}`}
            >
              <span
                className="d-flex align-items-center justify-content-center rounded-3 fw-bold small flex-shrink-0"
                style={{ width: 32, height: 32, background: 'var(--lms-tint)', color: 'var(--lms-deep)' }}
              >
                {index + 1}
              </span>
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="fw-semibold text-truncate">{lesson.title}</div>
                {(lesson.videoUrl || lesson.attachments.length > 0) && (
                  <div className="small text-body-secondary d-flex gap-3">
                    {lesson.videoUrl && (
                      <span>
                        <i className="bi bi-play-circle me-1" aria-hidden="true" />
                        Video
                      </span>
                    )}
                    {lesson.attachments.length > 0 && (
                      <span>
                        <i className="bi bi-paperclip me-1" aria-hidden="true" />
                        {lesson.attachments.length} {lesson.attachments.length === 1 ? 'file' : 'files'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="d-flex flex-shrink-0">
                <button
                  type="button"
                  className="lms-icon-action"
                  aria-label={`Move ${lesson.title} up`}
                  title="Move up"
                  disabled={moving || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <i className="bi bi-arrow-up" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lms-icon-action"
                  aria-label={`Move ${lesson.title} down`}
                  title="Move down"
                  disabled={moving || index === lessons.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <i className="bi bi-arrow-down" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lms-icon-action"
                  aria-label={`Edit ${lesson.title}`}
                  title="Edit"
                  onClick={() => setEditor({ show: true, lessonId: lesson.id })}
                >
                  <i className="bi bi-pencil-square" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="lms-icon-action lms-icon-action--danger"
                  aria-label={`Delete ${lesson.title}`}
                  title="Delete"
                  onClick={() => setToDelete(lesson)}
                >
                  <i className="bi bi-trash3" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LessonModal
        show={editor.show}
        courseId={courseId}
        lessonId={editor.lessonId}
        onHide={() => setEditor({ show: false, lessonId: null })}
        onSaved={loadLessons}
      />

      <ConfirmModal
        show={Boolean(toDelete)}
        title="Delete this lesson?"
        confirmLabel="Delete lesson"
        onConfirm={handleDelete}
        onHide={() => setToDelete(null)}
      >
        <p className="mb-0">
          <strong>{toDelete?.title}</strong> will be removed for every student.
        </p>
      </ConfirmModal>
    </>
  );
}

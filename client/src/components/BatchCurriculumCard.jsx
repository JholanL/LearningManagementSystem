/**
 * Curriculum panel for a batch detail page (trainer owns it, or admin).
 * Shows the batch's courses, each expandable to reveal its lessons, and a
 * "Manage courses" modal to edit which courses the batch's agents can see.
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Collapse, ListGroup, Modal, Spinner } from 'react-bootstrap';
import EmptyState from './EmptyState';
import { batchesApi, coursesApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { getErrorMessage } from '../utils/helpers';

export default function BatchCurriculumCard({ batchId }) {
  const toast = useToast();
  const [cur, setCur] = useState(null); // batch (with populated courses)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Expand → lazy-load that course's lessons
  const [openCourse, setOpenCourse] = useState(null);
  const [lessonsBy, setLessonsBy] = useState({}); // courseId → lessons[] | 'loading'

  // Manage modal
  const [showManage, setShowManage] = useState(false);
  const [allCourses, setAllCourses] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    batchesApi
      .get(batchId)
      .then((res) => { setCur(res.data); setError(''); })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpand = async (courseId) => {
    const next = openCourse === courseId ? null : courseId;
    setOpenCourse(next);
    if (next && !lessonsBy[courseId]) {
      setLessonsBy((m) => ({ ...m, [courseId]: 'loading' }));
      try {
        const res = await coursesApi.lessons(courseId);
        setLessonsBy((m) => ({ ...m, [courseId]: res.data || [] }));
      } catch {
        setLessonsBy((m) => ({ ...m, [courseId]: [] }));
      }
    }
  };

  const openManage = async () => {
    setShowManage(true);
    setSelected((cur?.courses || []).map((c) => String(c._id)));
    if (!allCourses.length) {
      setLoadingCourses(true);
      try {
        const res = await coursesApi.list({ limit: 100 });
        setAllCourses(res.data || []);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoadingCourses(false);
      }
    }
  };

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    try {
      await batchesApi.setCourses(batchId, selected);
      toast.success('Curriculum updated. Agents see the published ones.');
      setShowManage(false);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const courses = cur?.courses || [];

  return (
    <>
      <Card className="mb-3">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span><i className="bi bi-journal-bookmark me-1" />Curriculum <span className="text-muted small">({courses.length})</span></span>
          <Button size="sm" onClick={openManage}><i className="bi bi-pencil-square me-1" />Manage courses</Button>
        </Card.Header>
        {loading ? (
          <Card.Body className="text-muted small"><Spinner size="sm" className="me-1" />Loading curriculum…</Card.Body>
        ) : error ? (
          <Card.Body><EmptyState icon="bi-exclamation-triangle" title="Could not load" message={error} action={<Button size="sm" onClick={load}>Retry</Button>} /></Card.Body>
        ) : courses.length === 0 ? (
          <Card.Body><EmptyState icon="bi-journal-plus" title="No courses yet" message="Add courses so this batch's agents have something to study." /></Card.Body>
        ) : (
          <ListGroup variant="flush">
            {courses.map((c) => {
              const lessons = lessonsBy[c._id];
              const isOpen = openCourse === c._id;
              return (
                <ListGroup.Item key={c._id}>
                  <div className="d-flex align-items-center gap-2" role="button" onClick={() => toggleExpand(c._id)}>
                    <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} text-muted`} />
                    <div className="flex-grow-1 min-w-0">
                      <span className="fw-semibold">{c.code}</span> · {c.title}
                    </div>
                    {c.isPublished
                      ? <Badge bg="success-subtle" text="success-emphasis">Published</Badge>
                      : <Badge bg="secondary-subtle" text="secondary-emphasis">Draft</Badge>}
                  </div>
                  <Collapse in={isOpen}>
                    <div>
                      <div className="ps-4 pt-2">
                        {lessons === 'loading' || lessons === undefined ? (
                          <div className="small text-muted"><Spinner size="sm" className="me-1" />Loading lessons…</div>
                        ) : lessons.length === 0 ? (
                          <div className="small text-muted">No lessons yet.</div>
                        ) : (
                          <ol className="small text-muted mb-0 ps-3">
                            {lessons.map((l) => (
                              <li key={l._id} className="py-1">
                                {l.title}
                                {l.durationMinutes ? <span className="ms-1">· {l.durationMinutes} min</span> : null}
                                {l.videoUrl ? <i className="bi bi-play-btn ms-1" title="Has video" /> : null}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </div>
                  </Collapse>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}
        {!loading && !error && (
          <Card.Footer className="small text-muted">Agents only see <strong>published</strong> courses in this list.</Card.Footer>
        )}
      </Card>

      {/* Manage curriculum */}
      <Modal show={showManage} onHide={() => !saving && setShowManage(false)} centered scrollable>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Manage curriculum</Modal.Title>
            <p className="modal-subtitle">Pick the courses for this batch. Agents only see the published ones.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          {loadingCourses ? (
            <div className="text-muted small"><Spinner size="sm" className="me-1" />Loading courses…</div>
          ) : allCourses.length === 0 ? (
            <EmptyState icon="bi-journal-text" title="No courses" message="Create a course first." />
          ) : (
            <div className="border rounded p-2" style={{ maxHeight: 360, overflowY: 'auto' }}>
              {allCourses.map((c) => (
                <label key={c._id} className="d-flex align-items-center gap-2 py-1" htmlFor={`cc-${c._id}`} role="button">
                  <input
                    id={`cc-${c._id}`}
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={selected.includes(String(c._id))}
                    onChange={() => toggleSelect(String(c._id))}
                  />
                  <span>
                    <span className="fw-semibold">{c.code}</span> · {c.title}{' '}
                    {!c.isPublished && <Badge bg="light" text="dark">Draft</Badge>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <span className="small text-muted me-auto">{selected.length} selected</span>
          <Button variant="light" onClick={() => setShowManage(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || loadingCourses}>
            {saving && <Spinner size="sm" className="me-2" />}Save curriculum
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

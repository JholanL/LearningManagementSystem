/**
 * Course Builder (/trainer/courses/:id, also used by admin).
 * Builder tab: publish toggle + lessons (add/edit/delete/preview) + quizzes (→ Quiz Builder).
 * Analytics tab: feature 3. Role-aware — admin edits any course, trainer only their own
 * (the API enforces this).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Col, Form, Modal, Nav, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';
import CourseAnalytics from '../../components/CourseAnalytics';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, lessonsApi, quizzesApi } from '../../api/services';
import { getErrorMessage, getFieldErrors, toYouTubeEmbed, ROLE_HOME } from '../../utils/helpers';
import { isUrl, required, validate } from '../../utils/validators';

const EMPTY_LESSON = { title: '', content: '', videoUrl: '', order: '', durationMinutes: 10 };

export default function CourseBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const base = ROLE_HOME[user.role];
  const { data, loading, error, reload } = useFetch(() => coursesApi.get(id), [id]);

  const [tab, setTab] = useState('builder');
  const [publishing, setPublishing] = useState(false);

  // Lesson modal
  const [showLesson, setShowLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [form, setForm] = useState(EMPTY_LESSON);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete + preview
  const [toDelete, setToDelete] = useState(null); // { kind:'lesson'|'quiz', id, label }
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null); // lesson being previewed

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load course" message={error} action={<Button onClick={reload}>Retry</Button>} />;
  const course = data.data;
  const lessons = course.lessons || [];
  const quizzes = course.quizzes || [];

  const togglePublish = async () => {
    setPublishing(true);
    try {
      const res = await coursesApi.togglePublish(id);
      toast.success(res.message);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err)); // e.g. "Add at least one lesson before publishing."
    } finally {
      setPublishing(false);
    }
  };

  const openCreateLesson = () => {
    setEditingLesson(null);
    setForm({ ...EMPTY_LESSON, order: lessons.length + 1 });
    setErrors({});
    setShowLesson(true);
  };

  const openEditLesson = async (lesson) => {
    setEditingLesson(lesson._id);
    setErrors({});
    setShowLesson(true);
    try {
      const full = await lessonsApi.get(lesson._id); // the course payload omits lesson content
      setForm({
        title: full.data.title,
        content: full.data.content || '',
        videoUrl: full.data.videoUrl || '',
        order: full.data.order,
        durationMinutes: full.data.durationMinutes ?? 10,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setShowLesson(false);
    }
  };

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const saveLesson = async (e) => {
    e.preventDefault();
    const found = validate(form, {
      title: [required('Title')],
      content: [required('Content')],
      videoUrl: [[isUrl, 'Enter a valid URL (http/https)']],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      title: form.title,
      content: form.content,
      videoUrl: form.videoUrl || undefined,
      order: Number(form.order) || lessons.length + 1,
      durationMinutes: Number(form.durationMinutes) || 0,
    };
    setSaving(true);
    try {
      if (editingLesson) await lessonsApi.update(editingLesson, payload);
      else await coursesApi.createLesson(id, payload);
      toast.success(editingLesson ? 'Lesson updated.' : 'Lesson added.');
      setShowLesson(false);
      reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      if (toDelete.kind === 'lesson') await lessonsApi.remove(toDelete.id);
      else await quizzesApi.remove(toDelete.id);
      toast.success(`${toDelete.kind === 'lesson' ? 'Lesson' : 'Quiz'} deleted.`);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = async (lesson) => {
    setPreview(lesson); // show title/video immediately
    try {
      const full = await lessonsApi.get(lesson._id);
      setPreview((p) => (p && p._id === lesson._id ? { ...p, content: full.data.content, videoUrl: full.data.videoUrl } : p));
    } catch {
      /* keep the partial preview */
    }
  };

  const embed = toYouTubeEmbed(preview?.videoUrl);

  return (
    <>
      <PageHeader
        title={`${course.code} · ${course.title}`}
        icon="bi-tools"
        subtitle={`${course.category} · ${course.level}`}
        actions={
          <>
            <Badge bg={course.isPublished ? 'success' : 'secondary'} className="align-self-center me-1">
              {course.isPublished ? 'Published' : 'Draft'}
            </Badge>
            <Button variant={course.isPublished ? 'outline-secondary' : 'primary'} onClick={togglePublish} disabled={publishing}>
              {publishing ? <Spinner size="sm" /> : <i className={`bi ${course.isPublished ? 'bi-eye-slash' : 'bi-send'} me-1`} />}
              {course.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </>
        }
      />

      <Nav variant="tabs" activeKey={tab} onSelect={(k) => setTab(k)} className="mb-3">
        <Nav.Item><Nav.Link eventKey="builder">Builder</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="analytics">Analytics</Nav.Link></Nav.Item>
      </Nav>

      {tab === 'analytics' ? (
        <CourseAnalytics courseId={id} />
      ) : (
        <Row className="g-3">
          {/* Lessons */}
          <Col lg={7}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Lessons <span className="text-muted small">({lessons.length})</span></span>
                <Button size="sm" onClick={openCreateLesson}><i className="bi bi-plus-lg me-1" />Add lesson</Button>
              </Card.Header>
              <Card.Body>
                {lessons.length === 0 ? (
                  <EmptyState icon="bi-journal-text" title="No lessons yet" message="Add the first lesson to this course." />
                ) : (
                  <div className="table-responsive">
                    <Table hover className="align-middle mb-0">
                      <tbody>
                        {lessons.map((l) => (
                          <tr key={l._id}>
                            <td style={{ width: 40 }} className="text-muted">{l.order}</td>
                            <td>
                              <div className="fw-semibold">{l.title}</div>
                              <div className="small text-muted">
                                {l.durationMinutes || 0} min{l.videoUrl && <> · <i className="bi bi-youtube text-danger" /> video</>}
                              </div>
                            </td>
                            <td className="text-end text-nowrap">
                              <Button size="sm" variant="light" className="me-1" onClick={() => openPreview(l)} title="Preview"><i className="bi bi-eye" /></Button>
                              <Button size="sm" variant="light" className="me-1" onClick={() => openEditLesson(l)} title="Edit"><i className="bi bi-pencil" /></Button>
                              <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete({ kind: 'lesson', id: l._id, label: l.title })} title="Delete"><i className="bi bi-trash" /></Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Quizzes */}
          <Col lg={5}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Quizzes <span className="text-muted small">({quizzes.length})</span></span>
                <Button size="sm" onClick={() => navigate(`${base}/courses/${id}/quizzes/new`)}><i className="bi bi-plus-lg me-1" />Add quiz</Button>
              </Card.Header>
              <Card.Body>
                {quizzes.length === 0 ? (
                  <EmptyState icon="bi-ui-checks" title="No quizzes yet" message="Add a quiz to test this course." />
                ) : (
                  quizzes.map((q) => (
                    <div key={q._id} className="d-flex align-items-center justify-content-between border-bottom py-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-truncate">{q.title}</div>
                        <div className="small text-muted">{q.questionCount} question{q.questionCount !== 1 ? 's' : ''}{q.timeLimitMinutes ? ` · ${q.timeLimitMinutes} min` : ''}</div>
                      </div>
                      <div className="text-nowrap">
                        <Button size="sm" variant="light" className="me-1" as={Link} to={`${base}/quizzes/${q._id}/analytics`} title="Analytics"><i className="bi bi-bar-chart-line" /></Button>
                        <Button size="sm" variant="light" className="me-1" onClick={() => navigate(`${base}/quizzes/${q._id}`)} title="Edit"><i className="bi bi-pencil" /></Button>
                        <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete({ kind: 'quiz', id: q._id, label: q.title })} title="Delete"><i className="bi bi-trash" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Lesson modal */}
      <Modal show={showLesson} onHide={() => !saving && setShowLesson(false)} size="lg" centered>
        <Form noValidate onSubmit={saveLesson}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{editingLesson ? 'Edit lesson' : 'Add lesson'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={8} className="mb-3">
                <Form.Label htmlFor="title">Title</Form.Label>
                <Form.Control id="title" name="title" value={form.title} onChange={onChange} isInvalid={!!errors.title} maxLength={150} />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
              </Col>
              <Col md={2} xs={6} className="mb-3">
                <Form.Label htmlFor="order">Order</Form.Label>
                <Form.Control id="order" type="number" min={1} name="order" value={form.order} onChange={onChange} />
              </Col>
              <Col md={2} xs={6} className="mb-3">
                <Form.Label htmlFor="durationMinutes">Minutes</Form.Label>
                <Form.Control id="durationMinutes" type="number" min={0} max={600} name="durationMinutes" value={form.durationMinutes} onChange={onChange} />
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="videoUrl">YouTube URL <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control id="videoUrl" name="videoUrl" value={form.videoUrl} onChange={onChange} isInvalid={!!errors.videoUrl} placeholder="https://youtube.com/watch?v=..." />
                <Form.Control.Feedback type="invalid">{errors.videoUrl}</Form.Control.Feedback>
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="content">Content</Form.Label>
                <Form.Control id="content" as="textarea" rows={10} name="content" value={form.content} onChange={onChange} isInvalid={!!errors.content} maxLength={20000} placeholder="Lesson text. Line breaks are preserved." />
                <Form.Control.Feedback type="invalid">{errors.content}</Form.Control.Feedback>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowLesson(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Spinner size="sm" className="me-2" />}{editingLesson ? 'Save changes' : 'Add lesson'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Lesson preview */}
      <Modal show={!!preview} onHide={() => setPreview(null)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{preview?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {embed && (
            <div className="ratio ratio-16x9 mb-3">
              <iframe src={embed} title="Lesson video" allowFullScreen style={{ border: 0, borderRadius: 8 }} />
            </div>
          )}
          <div className="article-body">{preview?.content || <span className="text-muted">Open the editor to view the full content.</span>}</div>
        </Modal.Body>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title={`Delete ${toDelete?.kind}?`}
        message={<>Delete <strong>{toDelete?.label}</strong>? This cannot be undone.</>}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

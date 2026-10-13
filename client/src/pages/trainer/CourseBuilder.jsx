/**
 * Course Builder (/trainer/courses/:id, also used by admin).
 * Builder tab: publish toggle + lessons (add/edit/delete/preview) + quizzes (→ Quiz Builder).
 * Analytics tab: feature 3. Role-aware — admin edits any course, trainer only their own
 * (the API enforces this).
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Col, Dropdown, Form, Modal, Nav, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmModal from '../../components/ConfirmModal';
import CourseAnalytics from '../../components/CourseAnalytics';
import Markdown from '../../components/Markdown';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { aiApi, coursesApi, lessonsApi, quizzesApi } from '../../api/services';
import { getErrorMessage, getFieldErrors, toYouTubeEmbed, ROLE_HOME } from '../../utils/helpers';
import { isUrl, required, validate } from '../../utils/validators';
import { extractFileText, isImageFile, SUPPORTED_ACCEPT, SUPPORTED_FILE_HINT } from '../../utils/fileText';
import { splitIntoLessons } from '../../utils/pdfLessons';
import { formatLessonText } from '../../utils/formatLessonText';

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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [aiFmtBusy, setAiFmtBusy] = useState(false);
  const pdfInputRef = useRef(null);

  // Import a whole PDF, auto-split into multiple lessons
  const importInputRef = useRef(null);
  const [importBusy, setImportBusy] = useState(false);
  const [splitPreview, setSplitPreview] = useState(null); // [{ title, content }]
  const [creatingImport, setCreatingImport] = useState(false);

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

  // Extract text from a file (PDF/Word/PowerPoint/text/image) in the browser and add it to the lesson content.
  const onPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setPdfBusy(true);
    if (isImageFile(file)) toast.info('Reading text from the image (OCR)… this can take a few seconds.');
    try {
      const text = await extractFileText(file);
      if (!text) { toast.error('No readable text found in that file (a scanned/blurry image may not OCR well).'); return; }
      const LESSON_MAX = 20000; // matches the server limit; trim so it never fails validation
      const combined = form.content ? `${form.content}\n\n${text}` : text;
      const next = combined.slice(0, LESSON_MAX);
      const trimmed = next.length < combined.length;
      setForm((f) => ({ ...f, content: next }));
      setErrors((err) => ({ ...err, content: undefined }));
      toast.success(
        trimmed
          ? 'Text added (trimmed to fit the 20,000-character limit — split long files into separate lessons).'
          : 'Text added to the lesson content.'
      );
    } catch (err) {
      toast.error(`Could not read that file${err?.message ? `: ${err.message}` : ''}`);
    } finally {
      setPdfBusy(false);
    }
  };

  // Import a multi-page file and auto-split it into several lessons.
  const onImportPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportBusy(true);
    if (isImageFile(file)) toast.info('Reading text from the image (OCR)… this can take a few seconds.');
    try {
      const text = await extractFileText(file);
      if (!text) { toast.error('No readable text found in that file (a scanned/blurry image may not OCR well).'); return; }
      // Organise each piece instantly with the offline formatter (no AI / no network).
      const pieces = splitIntoLessons(text).map((p, i) => ({ title: p.title || `Lesson ${i + 1}`, content: formatLessonText(p.content) }));
      setSplitPreview(pieces);
    } catch (err) {
      toast.error(`Could not read that file${err?.message ? `: ${err.message}` : ''}`);
    } finally {
      setImportBusy(false);
    }
  };

  const updateSplitTitle = (idx, value) =>
    setSplitPreview((prev) => prev.map((p, i) => (i === idx ? { ...p, title: value } : p)));

  const createImportedLessons = async () => {
    setCreatingImport(true);
    let created = 0;
    try {
      for (let i = 0; i < splitPreview.length; i += 1) {
        const p = splitPreview[i];
        // eslint-disable-next-line no-await-in-loop
        await coursesApi.createLesson(id, {
          title: (p.title || `Lesson ${i + 1}`).slice(0, 150),
          content: p.content,
          order: lessons.length + 1 + i,
          durationMinutes: 10,
        });
        created += 1;
      }
      toast.success(`${created} lesson${created > 1 ? 's' : ''} created from the PDF.`);
      setSplitPreview(null);
      reload();
    } catch (err) {
      toast.error(`${getErrorMessage(err)}${created ? ` (${created} created before the error)` : ''}`);
      if (created) reload();
    } finally {
      setCreatingImport(false);
    }
  };

  // Insert a Markdown snippet at the cursor (Section / Image / Video helpers).
  const insertSnippet = (snippet) => {
    const ta = document.getElementById('content');
    const start = ta?.selectionStart ?? form.content.length;
    const end = ta?.selectionEnd ?? form.content.length;
    const next = `${form.content.slice(0, start)}${snippet}${form.content.slice(end)}`;
    setForm((f) => ({ ...f, content: next }));
    setErrors((err) => ({ ...err, content: undefined }));
  };

  // Organise the content instantly, offline (no AI): headings, bullets, short paragraphs.
  const autoFormatContent = () => {
    if (!form.content.trim()) { toast.error('Add some content first, or upload a file.'); return; }
    const formatted = formatLessonText(form.content);
    setForm((f) => ({ ...f, content: formatted }));
    setErrors((err) => ({ ...err, content: undefined }));
    toast.success('Content auto-organised into sections.');
  };

  // Reorganise the current lesson content into clean, sectioned Markdown via AI (optional, needs Gemini).
  const formatContent = async () => {
    if ((form.content || '').trim().length < 50) { toast.error('Add more content first (a few sentences).'); return; }
    setAiFmtBusy(true);
    try {
      const res = await aiApi.formatLesson(form.content);
      if (res.data.markdown) {
        setForm((f) => ({ ...f, content: res.data.markdown }));
        setErrors((err) => ({ ...err, content: undefined }));
        toast.success('Content organised into sections with AI. Review before saving.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAiFmtBusy(false);
    }
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

  // Open the delete dialog for a lesson, then fetch how many agents already completed it (for the warning).
  const askDeleteLesson = async (lesson) => {
    setToDelete({ kind: 'lesson', id: lesson._id, label: lesson.title });
    try {
      const full = await lessonsApi.get(lesson._id);
      const n = full.data.completedCount || 0;
      setToDelete((d) => (d && d.id === lesson._id ? { ...d, completedCount: n } : d));
    } catch {
      /* non-fatal: just skip the completion warning */
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
              <Card.Header className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <span>Lessons <span className="text-muted small">({lessons.length})</span></span>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="light" onClick={() => importInputRef.current?.click()} disabled={importBusy} title={`Upload a file (${SUPPORTED_FILE_HINT}) and auto-split it into lessons`}>
                    {importBusy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-file-earmark-arrow-up me-1" />}Import file
                  </Button>
                  <input ref={importInputRef} type="file" accept={SUPPORTED_ACCEPT} hidden onChange={onImportPdf} />
                  <Button size="sm" onClick={openCreateLesson}><i className="bi bi-plus-lg me-1" />Add lesson</Button>
                </div>
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
                              <Button size="sm" variant="light" className="text-danger" onClick={() => askDeleteLesson(l)} title="Delete"><i className="bi bi-trash" /></Button>
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
                        <div className="fw-semibold text-truncate">
                          {q.title}
                          {(() => {
                            const ql = q.lesson && lessons.find((x) => String(x._id) === String(q.lesson));
                            return <Badge bg={ql ? 'info' : 'secondary'} className="ms-2 fw-normal">{ql ? `After L${ql.order}` : 'Final'}</Badge>;
                          })()}
                        </div>
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
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label htmlFor="content" className="mb-0">Content <span className="text-muted small">(Markdown: ## sections, - bullets, images, video)</span></Form.Label>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button size="sm" variant="primary" type="button" onClick={autoFormatContent} disabled={!form.content.trim()} title="Organise into sections instantly (offline, no AI)">
                      <i className="bi bi-magic me-1" />Auto-format
                    </Button>
                    <Dropdown>
                      <Dropdown.Toggle size="sm" variant="light" id="insert-media"><i className="bi bi-plus-square me-1" />Insert</Dropdown.Toggle>
                      <Dropdown.Menu>
                        <Dropdown.Item onClick={() => insertSnippet('\n\n## Section title\n\n')}><i className="bi bi-type-h2 me-2" />Section heading</Dropdown.Item>
                        <Dropdown.Item onClick={() => insertSnippet('\n\n![description](https://example.com/image.jpg)\n\n')}><i className="bi bi-image me-2" />Image (URL)</Dropdown.Item>
                        <Dropdown.Item onClick={() => insertSnippet('\n\nhttps://www.youtube.com/watch?v=VIDEO_ID\n\n')}><i className="bi bi-youtube me-2" />YouTube video</Dropdown.Item>
                        <Dropdown.Item onClick={() => insertSnippet('\n\n- \n- \n- \n\n')}><i className="bi bi-list-ul me-2" />Bullet list</Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                    <Button size="sm" variant="light" type="button" onClick={formatContent} disabled={aiFmtBusy || !form.content.trim()} title="Optional: reorganise with AI (needs Gemini)">
                      {aiFmtBusy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-stars me-1" />}
                      AI
                    </Button>
                    <Button size="sm" variant="light" type="button" onClick={() => pdfInputRef.current?.click()} disabled={pdfBusy} title={`Fill from a file: ${SUPPORTED_FILE_HINT}`}>
                      {pdfBusy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-paperclip me-1" />}
                      Upload file
                    </Button>
                  </div>
                  <input ref={pdfInputRef} type="file" accept={SUPPORTED_ACCEPT} hidden onChange={onPdf} />
                </div>
                <Form.Control id="content" as="textarea" rows={10} name="content" value={form.content} onChange={onChange} isInvalid={!!errors.content} maxLength={20000} placeholder="Lesson text (or upload a file to fill this). Line breaks are preserved." />
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
          {preview?.content ? <Markdown text={preview.content} /> : <span className="text-muted">Open the editor to view the full content.</span>}
        </Modal.Body>
      </Modal>

      {/* PDF import → split into lessons preview */}
      <Modal show={!!splitPreview} onHide={() => !creatingImport && setSplitPreview(null)} size="lg" centered scrollable>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Import file as lessons</Modal.Title>
            <p className="modal-subtitle">Split into {splitPreview?.length || 0} lesson(s) and auto-organised into sections. Edit the titles, then create them.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          {splitPreview?.map((p, i) => (
            <div key={i} className="border rounded p-2 mb-2">
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="text-muted small" style={{ width: 24 }}>{lessons.length + 1 + i}</span>
                <Form.Control size="sm" value={p.title} onChange={(e) => updateSplitTitle(i, e.target.value)} placeholder={`Lesson ${i + 1} title`} maxLength={150} />
                <span className="small text-muted text-nowrap">{p.content.length.toLocaleString()} chars</span>
              </div>
              <div className="small text-muted text-truncate">{p.content.slice(0, 140)}…</div>
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setSplitPreview(null)} disabled={creatingImport}>Cancel</Button>
          <Button onClick={createImportedLessons} disabled={creatingImport}>
            {creatingImport ? <><Spinner size="sm" className="me-2" />Creating…</> : `Create ${splitPreview?.length || 0} lesson${splitPreview?.length > 1 ? 's' : ''}`}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title={`Delete ${toDelete?.kind}?`}
        message={
          <>
            Delete <strong>{toDelete?.label}</strong>? This cannot be undone.
            {toDelete?.kind === 'lesson' && toDelete.completedCount > 0 && (
              <div className="alert alert-warning mt-3 mb-0 py-2 small">
                <i className="bi bi-exclamation-triangle me-1" />
                {toDelete.completedCount} agent{toDelete.completedCount > 1 ? 's have' : ' has'} already completed this lesson.
                Deleting it will lower their course completion %. Quizzes are not affected.
              </div>
            )}
          </>
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

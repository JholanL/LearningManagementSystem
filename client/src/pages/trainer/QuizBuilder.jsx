/**
 * Quiz Builder.
 *   /trainer/courses/:courseId/quizzes/new  → create
 *   /trainer/quizzes/:id                     → edit (also opened by the Analytics "Edit question" link, ?q=<id>)
 * Dynamic question form (2-6 options, a correct answer, explanation, points).
 * Role-aware; the API enforces course ownership.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { aiApi, coursesApi, quizzesApi } from '../../api/services';
import { getErrorMessage, ROLE_HOME } from '../../utils/helpers';
import { extractFileText, isImageFile, SUPPORTED_ACCEPT, SUPPORTED_FILE_HINT } from '../../utils/fileText';

const blankQuestion = () => ({ question: '', options: ['', ''], correctAnswer: 0, explanation: '', points: 1 });

export default function QuizBuilder() {
  const { id, courseId: courseIdParam } = useParams();
  const [params] = useSearchParams();
  const highlightQ = params.get('q');
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const base = ROLE_HOME[user.role];
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [courseId, setCourseId] = useState(courseIdParam || null);
  const [form, setForm] = useState({ title: '', description: '', timeLimitMinutes: 0, questions: [blankQuestion()] });
  const [lessonId, setLessonId] = useState(''); // '' = course-level (final) quiz
  const [courseLessons, setCourseLessons] = useState([]); // for the "After lesson" selector
  const [saving, setSaving] = useState(false);
  const [errField, setErrField] = useState(null); // which control failed validation (for red + scroll + shake)
  const scrolledRef = useRef(false);

  // AI quiz generation
  const [showAi, setShowAi] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPdfBusy, setAiPdfBusy] = useState(false);
  const [lessonsBusy, setLessonsBusy] = useState(false);
  const [aiLessons, setAiLessons] = useState([]); // this course's lessons (pick which feed the AI)
  const [aiLessonIds, setAiLessonIds] = useState([]); // selected lesson ids
  const aiPdfRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    quizzesApi
      .get(id)
      .then((res) => {
        if (ignore) return;
        const q = res.data;
        setCourseId(String(q.course));
        setLessonId(q.lesson ? String(q.lesson) : '');
        setForm({
          title: q.title || '',
          description: q.description || '',
          timeLimitMinutes: q.timeLimitMinutes || 0,
          questions: (q.questions || []).map((x) => ({
            _id: x._id,
            question: x.question,
            options: [...x.options],
            correctAnswer: x.correctAnswer,
            explanation: x.explanation || '',
            points: x.points || 1,
          })),
        });
      })
      .catch((err) => !ignore && setLoadError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [id, isEdit]);

  // Load the course lessons for the "After lesson" selector.
  useEffect(() => {
    if (!courseId) return;
    let ignore = false;
    coursesApi.lessons(courseId)
      .then((res) => { if (!ignore) setCourseLessons(res.data || []); })
      .catch(() => { /* selector just stays limited to "Final" */ });
    return () => { ignore = true; };
  }, [courseId]);

  // Scroll to the question the Analytics page asked to edit (?q=).
  useEffect(() => {
    if (!highlightQ || scrolledRef.current || loading) return;
    const el = document.getElementById(`q-${highlightQ}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('q-highlight');
      scrolledRef.current = true;
    }
  }, [highlightQ, loading, form]);

  // --- mutators ---
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setQ = (i, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) }));
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, blankQuestion()] }));
  const removeQuestion = (i) => setForm((f) => ({ ...f, questions: f.questions.filter((_, idx) => idx !== i) }));
  const setOption = (i, oi, value) => setQ(i, { options: form.questions[i].options.map((o, idx) => (idx === oi ? value : o)) });
  const addOption = (i) => form.questions[i].options.length < 6 && setQ(i, { options: [...form.questions[i].options, ''] });
  const removeOption = (i, oi) => {
    const q = form.questions[i];
    if (q.options.length <= 2) return;
    const options = q.options.filter((_, idx) => idx !== oi);
    const correctAnswer = q.correctAnswer >= options.length ? 0 : q.correctAnswer;
    setQ(i, { options, correctAnswer });
  };

  const validateForm = () => {
    if (!form.title.trim()) return { message: 'Quiz title is required.', field: 'title' };
    if (form.questions.length === 0) return { message: 'Add at least one question.', field: null };
    for (let i = 0; i < form.questions.length; i += 1) {
      const q = form.questions[i];
      if (!q.question.trim()) return { message: `Question ${i + 1}: text is required.`, field: `q${i}` };
      const filled = q.options.filter((o) => o.trim());
      if (filled.length < 2) {
        const oi = q.options.findIndex((o) => !o.trim());
        return { message: `Question ${i + 1}: needs at least 2 non-empty options.`, field: `q${i}o${oi >= 0 ? oi : 0}` };
      }
      if (!q.options[q.correctAnswer] || !q.options[q.correctAnswer].trim()) {
        return { message: `Question ${i + 1}: pick a correct answer that isn't blank.`, field: `q${i}o${q.correctAnswer}` };
      }
    }
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validateForm();
    if (problem) { setErrField(problem.field); toast.error(problem.message); return; }
    setErrField(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      timeLimitMinutes: Number(form.timeLimitMinutes) || 0,
      lesson: lessonId || null, // null = course-level (final) quiz
      questions: form.questions.map((q) => {
        // Drop blank options, and remap correctAnswer to the kept option's new index.
        const kept = q.options.map((o, idx) => ({ text: o.trim(), idx })).filter((x) => x.text);
        const correctAnswer = Math.max(0, kept.findIndex((x) => x.idx === q.correctAnswer));
        return {
          ...(q._id && { _id: q._id }),
          question: q.question.trim(),
          options: kept.map((x) => x.text),
          correctAnswer,
          explanation: q.explanation.trim() || undefined,
          points: Number(q.points) || 1,
        };
      }),
    };
    setSaving(true);
    try {
      if (isEdit) await quizzesApi.update(id, payload);
      else await coursesApi.createQuiz(courseId, payload);
      toast.success(isEdit ? 'Quiz saved.' : 'Quiz created.');
      navigate(`${base}/courses/${courseId}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Build the source text from the chosen lessons.
  const buildLessonText = (lessons, ids) =>
    lessons
      .filter((l) => ids.includes(String(l._id)))
      .map((l) => `${l.title}\n${l.content || ''}`)
      .join('\n\n')
      .trim()
      .slice(0, 15000);

  // Put the selected lessons' content into the Source text box.
  const loadLessons = (ids = aiLessonIds, lessons = aiLessons) => {
    const text = buildLessonText(lessons, ids);
    if (text) setAiText(text);
    else if (lessons.length) toast.error('Pick at least one lesson, paste text, or upload a PDF.');
  };

  // Tick/untick a lesson, then rebuild the source text from the new selection.
  const toggleLesson = (lessonId) => {
    const id = String(lessonId);
    const next = aiLessonIds.includes(id) ? aiLessonIds.filter((x) => x !== id) : [...aiLessonIds, id];
    setAiLessonIds(next);
    loadLessons(next, aiLessons);
  };

  const setAllLessons = (all) => {
    const next = all ? aiLessons.map((l) => String(l._id)) : [];
    setAiLessonIds(next);
    loadLessons(next, aiLessons);
  };

  // Open the AI modal; load this course's lessons, select them all, and fill the source text.
  const openAi = async () => {
    setShowAi(true);
    if (aiLessons.length || !courseId) {
      if (!aiText.trim()) loadLessons();
      return;
    }
    setLessonsBusy(true);
    try {
      const res = await coursesApi.lessons(courseId);
      const lessons = res.data || [];
      const ids = lessons.map((l) => String(l._id));
      setAiLessons(lessons);
      setAiLessonIds(ids);
      if (!aiText.trim()) loadLessons(ids, lessons);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLessonsBusy(false);
    }
  };

  const onAiPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAiPdfBusy(true);
    if (isImageFile(file)) toast.info('Reading text from the image (OCR)… this can take a few seconds.');
    try {
      const text = await extractFileText(file);
      if (!text) { toast.error('No readable text found in that file.'); return; }
      setAiText((prev) => (prev ? `${prev}\n\n${text}` : text));
    } catch (err) {
      toast.error(`Could not read that file${err?.message ? `: ${err.message}` : ''}`);
    } finally {
      setAiPdfBusy(false);
    }
  };

  const generate = async () => {
    if (aiText.trim().length < 50) { toast.error('Paste or upload a bit more text first (a few sentences).'); return; }
    setAiBusy(true);
    try {
      const res = await aiApi.generateQuiz(aiText, aiCount);
      const gen = res.data.questions.map((q) => ({
        question: q.question,
        options: q.options.length >= 2 ? [...q.options] : [...q.options, '', ''].slice(0, 2),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || '',
        points: q.points || 1,
      }));
      setForm((f) => {
        const kept = f.questions.filter((q) => q.question.trim() || q.options.some((o) => o.trim()));
        return {
          ...f,
          // Fill details only when the trainer hasn't typed them (don't overwrite their input).
          title: f.title.trim() ? f.title : (res.data.title || f.title),
          description: f.description.trim() ? f.description : (res.data.description || f.description),
          timeLimitMinutes: Number(f.timeLimitMinutes) ? f.timeLimitMinutes : (res.data.timeLimitMinutes || f.timeLimitMinutes),
          questions: [...kept, ...gen],
        };
      });
      setErrField(null);
      toast.success(`Added ${gen.length} AI question${gen.length > 1 ? 's' : ''} + quiz details. Review and edit before saving.`);
      setShowAi(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setAiBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (loadError) return <EmptyState icon="bi-exclamation-triangle" title="Could not load quiz" message={loadError} action={<Button onClick={() => navigate(-1)}>Back</Button>} />;

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit quiz' : 'New quiz'}
        icon="bi-ui-checks"
        actions={
          <>
            <Button variant="outline-primary" onClick={openAi}><i className="bi bi-stars me-1" />Generate with AI</Button>
            <Button variant="light" onClick={() => navigate(courseId ? `${base}/courses/${courseId}` : -1)}><i className="bi bi-arrow-left me-1" />Back to course</Button>
          </>
        }
      />

      <Form noValidate onSubmit={save}>
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={7} className="mb-3">
                <Form.Label htmlFor="title">Quiz title</Form.Label>
                <Form.Control id="title" value={form.title} onChange={(e) => { setField('title', e.target.value); setErrField(null); }} isInvalid={errField === 'title'} maxLength={150} />
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label htmlFor="desc">Description <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control id="desc" value={form.description} onChange={(e) => setField('description', e.target.value)} maxLength={1000} />
              </Col>
              <Col md={2} className="mb-3">
                <Form.Label htmlFor="time">Time limit (min)</Form.Label>
                <Form.Control id="time" type="number" min={0} max={180} value={form.timeLimitMinutes} onChange={(e) => setField('timeLimitMinutes', e.target.value)} />
                <Form.Text>0 = none</Form.Text>
              </Col>
              <Col md={12} className="mb-1">
                <Form.Label htmlFor="quiz-lesson">Show after</Form.Label>
                <Form.Select id="quiz-lesson" value={lessonId} onChange={(e) => setLessonId(e.target.value)} style={{ maxWidth: 420 }}>
                  <option value="">Final — after all lessons (whole course)</option>
                  {courseLessons.map((l) => (
                    <option key={l._id} value={l._id}>After lesson {l.order}: {l.title}</option>
                  ))}
                </Form.Select>
                <Form.Text>Agents take this quiz right after that lesson. A final quiz appears at the end.</Form.Text>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {form.questions.map((q, i) => (
          <Card className="mb-3" key={q._id || i} id={q._id ? `q-${q._id}` : undefined}>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <span className="fw-semibold">Question {i + 1}</span>
                <Button size="sm" variant="light" className="text-danger" onClick={() => removeQuestion(i)} disabled={form.questions.length <= 1} title="Remove question"><i className="bi bi-trash" /></Button>
              </div>
              <Form.Control className="mb-3" as="textarea" rows={2} value={q.question} onChange={(e) => { setQ(i, { question: e.target.value }); setErrField(null); }} isInvalid={errField === `q${i}`} placeholder="Question text" maxLength={1000} />

              <div className="small text-muted mb-1">Options <span>(tick the correct answer)</span></div>
              {q.options.map((opt, oi) => (
                <div key={oi} className="d-flex align-items-center gap-2 mb-2">
                  <Form.Check type="radio" name={`correct-${i}`} checked={q.correctAnswer === oi} onChange={() => setQ(i, { correctAnswer: oi })} aria-label={`Mark option ${oi + 1} correct`} />
                  <Form.Control value={opt} onChange={(e) => { setOption(i, oi, e.target.value); setErrField(null); }} isInvalid={errField === `q${i}o${oi}`} placeholder={`Option ${oi + 1}`} maxLength={500} />
                  <Button size="sm" variant="light" className="text-danger" onClick={() => removeOption(i, oi)} disabled={q.options.length <= 2} title="Remove option"><i className="bi bi-x-lg" /></Button>
                </div>
              ))}
              {q.options.length < 6 && (
                <Button size="sm" variant="link" className="px-0" onClick={() => addOption(i)}><i className="bi bi-plus-lg me-1" />Add option</Button>
              )}

              <Row className="mt-2">
                <Col md={9} className="mb-2">
                  <Form.Label className="small">Explanation <span className="text-muted">(shown after answering)</span></Form.Label>
                  <Form.Control value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} maxLength={1000} />
                </Col>
                <Col md={3} className="mb-2">
                  <Form.Label className="small">Points</Form.Label>
                  <Form.Control type="number" min={1} max={100} value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} />
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}

        <div className="d-flex flex-wrap gap-2 mb-5">
          <Button variant="outline-secondary" onClick={addQuestion}><i className="bi bi-plus-lg me-1" />Add question</Button>
          <Button variant="outline-primary" onClick={openAi}><i className="bi bi-stars me-1" />Generate with AI</Button>
          <Button type="submit" disabled={saving} className="ms-auto">
            {saving && <Spinner size="sm" className="me-2" />}{isEdit ? 'Save quiz' : 'Create quiz'}
          </Button>
        </div>
      </Form>

      {/* Generate questions from lesson text / a PDF */}
      <Modal show={showAi} onHide={() => !aiBusy && setShowAi(false)} centered size="lg">
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5"><i className="bi bi-stars me-1" />Generate quiz with AI</Modal.Title>
            <p className="modal-subtitle">Uses this course&apos;s lessons by default. You can also paste text or upload a PDF. Review & edit before saving.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          {(aiLessons.length > 0 || lessonsBusy) && (
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <Form.Label className="mb-0">Lessons to use</Form.Label>
                {aiLessons.length > 0 && (
                  <div className="small">
                    <Button variant="link" size="sm" className="px-1 py-0" onClick={() => setAllLessons(true)}>All</Button>
                    <span className="text-muted">·</span>
                    <Button variant="link" size="sm" className="px-1 py-0" onClick={() => setAllLessons(false)}>None</Button>
                  </div>
                )}
              </div>
              {lessonsBusy && !aiLessons.length ? (
                <div className="text-muted small"><Spinner size="sm" className="me-1" />Loading lessons…</div>
              ) : (
                <div className="border rounded p-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
                  {aiLessons.map((l) => (
                    <Form.Check
                      key={l._id}
                      type="checkbox"
                      id={`ai-lesson-${l._id}`}
                      label={l.title}
                      checked={aiLessonIds.includes(String(l._id))}
                      onChange={() => toggleLesson(l._id)}
                    />
                  ))}
                </div>
              )}
              <Form.Text>Tick the lessons whose content the AI should turn into questions.</Form.Text>
            </div>
          )}
          <div className="d-flex justify-content-between align-items-center gap-2 mb-1 flex-wrap">
            <Form.Label className="mb-0">Source text</Form.Label>
            <div className="d-flex gap-2">
              {aiLessons.length > 0 && (
                <Button size="sm" variant="light" type="button" onClick={() => loadLessons()} disabled={lessonsBusy}>
                  {lessonsBusy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-journal-text me-1" />}Reload from lessons
                </Button>
              )}
              <Button size="sm" variant="light" type="button" onClick={() => aiPdfRef.current?.click()} disabled={aiPdfBusy} title={`Add text from a file: ${SUPPORTED_FILE_HINT}`}>
                {aiPdfBusy ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-paperclip me-1" />}Upload file
              </Button>
              <input ref={aiPdfRef} type="file" accept={SUPPORTED_ACCEPT} hidden onChange={onAiPdf} />
            </div>
          </div>
          <Form.Control as="textarea" rows={8} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="Loads from the course lessons automatically. Or paste text / upload a PDF." />
          <div className="d-flex align-items-center gap-2 mt-3">
            <Form.Label className="mb-0">Number of questions</Form.Label>
            <Form.Select style={{ maxWidth: 90 }} value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))}>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </Form.Select>
            <span className="small text-muted ms-auto">{aiText.trim().length} chars</span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowAi(false)} disabled={aiBusy}>Cancel</Button>
          <Button onClick={generate} disabled={aiBusy}>
            {aiBusy ? <><Spinner size="sm" className="me-2" />Generating…</> : <><i className="bi bi-stars me-1" />Generate</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

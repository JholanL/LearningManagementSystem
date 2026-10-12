/**
 * Quiz Builder.
 *   /trainer/courses/:courseId/quizzes/new  → create
 *   /trainer/quizzes/:id                     → edit (also opened by the Analytics "Edit question" link, ?q=<id>)
 * Dynamic question form (2-6 options, a correct answer, explanation, points).
 * Role-aware; the API enforces course ownership.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, quizzesApi } from '../../api/services';
import { getErrorMessage, ROLE_HOME } from '../../utils/helpers';

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
  const [saving, setSaving] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    quizzesApi
      .get(id)
      .then((res) => {
        if (ignore) return;
        const q = res.data;
        setCourseId(String(q.course));
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
    if (!form.title.trim()) return 'Quiz title is required.';
    if (form.questions.length === 0) return 'Add at least one question.';
    for (let i = 0; i < form.questions.length; i += 1) {
      const q = form.questions[i];
      if (!q.question.trim()) return `Question ${i + 1}: text is required.`;
      const filled = q.options.filter((o) => o.trim());
      if (filled.length < 2) return `Question ${i + 1}: needs at least 2 non-empty options.`;
      if (!q.options[q.correctAnswer] || !q.options[q.correctAnswer].trim()) return `Question ${i + 1}: pick a correct answer that isn't blank.`;
    }
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validateForm();
    if (problem) { toast.error(problem); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      timeLimitMinutes: Number(form.timeLimitMinutes) || 0,
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

  if (loading) return <LoadingSpinner />;
  if (loadError) return <EmptyState icon="bi-exclamation-triangle" title="Could not load quiz" message={loadError} action={<Button onClick={() => navigate(-1)}>Back</Button>} />;

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit quiz' : 'New quiz'}
        icon="bi-ui-checks"
        actions={<Button variant="light" onClick={() => navigate(courseId ? `${base}/courses/${courseId}` : -1)}><i className="bi bi-arrow-left me-1" />Back to course</Button>}
      />

      <Form noValidate onSubmit={save}>
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={7} className="mb-3">
                <Form.Label htmlFor="title">Quiz title</Form.Label>
                <Form.Control id="title" value={form.title} onChange={(e) => setField('title', e.target.value)} maxLength={150} />
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
              <Form.Control className="mb-3" as="textarea" rows={2} value={q.question} onChange={(e) => setQ(i, { question: e.target.value })} placeholder="Question text" maxLength={1000} />

              <div className="small text-muted mb-1">Options <span>(tick the correct answer)</span></div>
              {q.options.map((opt, oi) => (
                <div key={oi} className="d-flex align-items-center gap-2 mb-2">
                  <Form.Check type="radio" name={`correct-${i}`} checked={q.correctAnswer === oi} onChange={() => setQ(i, { correctAnswer: oi })} aria-label={`Mark option ${oi + 1} correct`} />
                  <Form.Control value={opt} onChange={(e) => setOption(i, oi, e.target.value)} placeholder={`Option ${oi + 1}`} maxLength={500} />
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
          <Button type="submit" disabled={saving} className="ms-auto">
            {saving && <Spinner size="sm" className="me-2" />}{isEdit ? 'Save quiz' : 'Create quiz'}
          </Button>
        </div>
      </Form>
    </>
  );
}

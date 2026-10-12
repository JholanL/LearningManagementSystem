/**
 * Scenario Builder (/trainer/scenarios/new and /trainer/scenarios/:id).
 * Branching call: customer briefing + steps, each with 2-4 response options that
 * score 0-10 and point to the next step (or end the call). Validation mirrors the
 * server (unique step keys, startStep + every nextStep must point to a real step).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { scenariosApi, metaApi } from '../../api/services';
import { getErrorMessage } from '../../utils/helpers';

const blankOption = () => ({ text: '', score: 5, feedback: '', nextStep: '', keywordsText: '' });
const blankStep = (key) => ({ key, customerLine: '', options: [blankOption(), blankOption()] });
const EMPTY = {
  title: '', description: '', category: 'Billing', difficulty: 'Easy', passingScore: 70,
  customer: { name: '', mood: 'calm', issue: '' },
  startStep: 'opening',
  steps: [blankStep('opening')],
};

export default function ScenarioBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState({ scenarioCategories: [], scenarioDifficulties: [], customerMoods: [] });
  const keyCounter = useRef(2);

  useEffect(() => {
    metaApi.get().then((res) => setMeta(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    scenariosApi
      .get(id)
      .then((res) => {
        if (ignore) return;
        const s = res.data;
        setForm({
          title: s.title, description: s.description || '', category: s.category, difficulty: s.difficulty,
          passingScore: s.passingScore, customer: { ...s.customer },
          startStep: s.startStep,
          steps: s.steps.map((st) => ({
            key: st.key,
            customerLine: st.customerLine,
            options: st.options.map((o) => ({
              text: o.text, score: o.score, feedback: o.feedback || '',
              nextStep: o.nextStep || '', keywordsText: (o.keywords || []).join(', '),
            })),
          })),
        });
      })
      .catch((err) => !ignore && setLoadError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [id, isEdit]);

  // --- mutators ---
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const setCustomer = (field, value) => setForm((f) => ({ ...f, customer: { ...f.customer, [field]: value } }));
  const setStep = (i, patch) => setForm((f) => ({ ...f, steps: f.steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));
  const setOpt = (si, oi, patch) => setStep(si, { options: form.steps[si].options.map((o, idx) => (idx === oi ? { ...o, ...patch } : o)) });

  const addStep = () => {
    keyCounter.current += 1;
    setForm((f) => ({ ...f, steps: [...f.steps, blankStep(`step${keyCounter.current}`)] }));
  };
  const removeStep = (i) => setForm((f) => ({ ...f, steps: f.steps.filter((_, idx) => idx !== i) }));
  const addOption = (si) => form.steps[si].options.length < 4 && setStep(si, { options: [...form.steps[si].options, blankOption()] });
  const removeOption = (si, oi) => form.steps[si].options.length > 2 && setStep(si, { options: form.steps[si].options.filter((_, idx) => idx !== oi) });

  const stepKeys = form.steps.map((s) => s.key);

  const validateForm = () => {
    if (!form.title.trim()) return 'Scenario title is required.';
    if (!form.customer.name.trim()) return 'Customer name is required.';
    if (!form.customer.issue.trim()) return 'Customer issue is required.';
    if (form.steps.length === 0) return 'Add at least one step.';
    const keys = form.steps.map((s) => s.key.trim());
    if (keys.some((k) => !k)) return 'Every step needs a key.';
    if (new Set(keys).size !== keys.length) return 'Step keys must be unique.';
    if (!keys.includes(form.startStep)) return 'Start step must match one of the step keys.';
    for (let i = 0; i < form.steps.length; i += 1) {
      const s = form.steps[i];
      if (!s.customerLine.trim()) return `Step "${s.key}": customer line is required.`;
      if (s.options.length < 2 || s.options.length > 4) return `Step "${s.key}": needs 2-4 options.`;
      for (let o = 0; o < s.options.length; o += 1) {
        const opt = s.options[o];
        if (!opt.text.trim()) return `Step "${s.key}", option ${o + 1}: text is required.`;
        if (opt.score < 0 || opt.score > 10) return `Step "${s.key}", option ${o + 1}: score must be 0-10.`;
        if (opt.nextStep && !keys.includes(opt.nextStep)) return `Step "${s.key}", option ${o + 1}: next step points to a missing step.`;
      }
    }
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validateForm();
    if (problem) { toast.error(problem); return; }

    const payload = {
      title: form.title.trim(), description: form.description.trim() || undefined,
      category: form.category, difficulty: form.difficulty, passingScore: Number(form.passingScore) || 70,
      customer: { name: form.customer.name.trim(), mood: form.customer.mood, issue: form.customer.issue.trim() },
      startStep: form.startStep,
      steps: form.steps.map((s) => ({
        key: s.key.trim(),
        customerLine: s.customerLine.trim(),
        options: s.options.map((o) => ({
          text: o.text.trim(),
          score: Number(o.score),
          feedback: o.feedback.trim() || undefined,
          nextStep: o.nextStep || null,
          keywords: o.keywordsText.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean).slice(0, 10),
        })),
      })),
    };
    setSaving(true);
    try {
      if (isEdit) await scenariosApi.update(id, payload);
      else await scenariosApi.create(payload);
      toast.success(isEdit ? 'Scenario saved.' : 'Scenario created.');
      navigate('/trainer/scenarios');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (loadError) return <EmptyState icon="bi-exclamation-triangle" title="Could not load scenario" message={loadError} action={<Button onClick={() => navigate('/trainer/scenarios')}>Back</Button>} />;

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit scenario' : 'New scenario'}
        icon="bi-headset"
        actions={<Button variant="light" onClick={() => navigate('/trainer/scenarios')}><i className="bi bi-arrow-left me-1" />Back</Button>}
      />

      <Form noValidate onSubmit={save}>
        {/* Scenario + customer */}
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control value={form.title} onChange={(e) => setField('title', e.target.value)} maxLength={150} />
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label>Category</Form.Label>
                <Form.Select value={form.category} onChange={(e) => setField('category', e.target.value)}>
                  {meta.scenarioCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label>Difficulty</Form.Label>
                <Form.Select value={form.difficulty} onChange={(e) => setField('difficulty', e.target.value)}>
                  {meta.scenarioDifficulties.map((d) => <option key={d} value={d}>{d}</option>)}
                </Form.Select>
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label>Description <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control value={form.description} onChange={(e) => setField('description', e.target.value)} maxLength={1000} />
              </Col>
              <Col md={5} className="mb-3">
                <Form.Label>Customer name</Form.Label>
                <Form.Control value={form.customer.name} onChange={(e) => setCustomer('name', e.target.value)} />
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label>Mood</Form.Label>
                <Form.Select value={form.customer.mood} onChange={(e) => setCustomer('mood', e.target.value)}>
                  {(meta.customerMoods.length ? meta.customerMoods : ['calm', 'confused', 'frustrated', 'irate']).map((m) => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Pass mark (%)</Form.Label>
                <Form.Control type="number" min={1} max={100} value={form.passingScore} onChange={(e) => setField('passingScore', e.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Label>Customer issue</Form.Label>
                <Form.Control value={form.customer.issue} onChange={(e) => setCustomer('issue', e.target.value)} maxLength={500} />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Start step */}
        <Card className="mb-3">
          <Card.Body className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0">Start at step:</Form.Label>
            <Form.Select style={{ maxWidth: 220 }} value={form.startStep} onChange={(e) => setField('startStep', e.target.value)}>
              {stepKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </Form.Select>
          </Card.Body>
        </Card>

        {/* Steps */}
        {form.steps.map((s, si) => (
          <Card className="mb-3" key={si}>
            <Card.Header className="d-flex align-items-center gap-2">
              <span className="fw-semibold">Step</span>
              <Form.Control size="sm" style={{ maxWidth: 160 }} value={s.key} onChange={(e) => setStep(si, { key: e.target.value.replace(/\s+/g, '') })} placeholder="step key" />
              <Button size="sm" variant="light" className="text-danger ms-auto" onClick={() => removeStep(si)} disabled={form.steps.length <= 1} title="Remove step"><i className="bi bi-trash" /></Button>
            </Card.Header>
            <Card.Body>
              <Form.Label className="small">Customer says</Form.Label>
              <Form.Control className="mb-3" as="textarea" rows={2} value={s.customerLine} onChange={(e) => setStep(si, { customerLine: e.target.value })} maxLength={1000} />

              <div className="small fw-semibold mb-2">Agent options (2-4)</div>
              {s.options.map((o, oi) => (
                <div key={oi} className="border rounded p-2 mb-2">
                  <Row className="g-2">
                    <Col xs={12}>
                      <Form.Control size="sm" value={o.text} onChange={(e) => setOpt(si, oi, { text: e.target.value })} placeholder={`Option ${oi + 1} — what the agent says`} maxLength={500} />
                    </Col>
                    <Col sm={3}>
                      <Form.Label className="small mb-0">Score (0-10)</Form.Label>
                      <Form.Control size="sm" type="number" min={0} max={10} value={o.score} onChange={(e) => setOpt(si, oi, { score: e.target.value })} />
                    </Col>
                    <Col sm={5}>
                      <Form.Label className="small mb-0">Next step</Form.Label>
                      <Form.Select size="sm" value={o.nextStep} onChange={(e) => setOpt(si, oi, { nextStep: e.target.value })}>
                        <option value="">— End the call —</option>
                        {stepKeys.filter((k) => k && k !== s.key).map((k) => <option key={k} value={k}>{k}</option>)}
                      </Form.Select>
                    </Col>
                    <Col sm={4}>
                      <Form.Label className="small mb-0">Keywords <span className="text-muted">(voice)</span></Form.Label>
                      <Form.Control size="sm" value={o.keywordsText} onChange={(e) => setOpt(si, oi, { keywordsText: e.target.value })} placeholder="verify, birthdate" />
                    </Col>
                    <Col xs={12}>
                      <Form.Control size="sm" value={o.feedback} onChange={(e) => setOpt(si, oi, { feedback: e.target.value })} placeholder="Feedback shown after this choice (optional)" maxLength={500} />
                    </Col>
                    <Col xs={12} className="text-end">
                      <Button size="sm" variant="link" className="text-danger p-0" onClick={() => removeOption(si, oi)} disabled={s.options.length <= 2}>Remove option</Button>
                    </Col>
                  </Row>
                </div>
              ))}
              {s.options.length < 4 && <Button size="sm" variant="link" className="px-0" onClick={() => addOption(si)}><i className="bi bi-plus-lg me-1" />Add option</Button>}
            </Card.Body>
          </Card>
        ))}

        <div className="d-flex flex-wrap gap-2 mb-5">
          <Button variant="outline-secondary" onClick={addStep}><i className="bi bi-plus-lg me-1" />Add step</Button>
          <Button type="submit" disabled={saving} className="ms-auto">{saving && <Spinner size="sm" className="me-2" />}{isEdit ? 'Save scenario' : 'Create scenario'}</Button>
        </div>
      </Form>
    </>
  );
}

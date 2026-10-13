/**
 * Scenario Builder (/trainer/scenarios/new and /trainer/scenarios/:id).
 *
 * A branching call: customer briefing + steps, each with 2-4 response options that
 * score 0-10 and branch to the next step (or end the call).
 *
 * UX: step keys are auto-managed (hidden from the trainer) — steps are shown as
 * "Step N" and linked by a human label. Extras: a live Flow map (reachability +
 * dead-end / unreachable warnings), a scoring summary, and an in-place Test run
 * that plays the scenario from the current form without saving.
 * The saved shape still matches the server (keys + nextStep + startStep).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, Col, Collapse, Dropdown, Form, Modal, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { scenariosApi, metaApi } from '../../api/services';
import { getErrorMessage } from '../../utils/helpers';
import { extractFileText } from '../../utils/fileText';
import { TEMPLATE_LINES, downloadScenarioDocx, formToLines, parseScenarioText } from '../../utils/scenarioDoc';

const MAX_STEP_SCORE = 10;
const blankOption = () => ({ text: '', score: 5, feedback: '', nextStep: '', keywordsText: '' });
const blankStep = (key) => ({ key, customerLine: '', options: [blankOption(), blankOption()] });
const EMPTY = {
  title: '', description: '', category: 'Billing', difficulty: 'Easy', passingScore: 70,
  customer: { name: '', mood: 'calm', issue: '' },
  startStep: 's1',
  steps: [blankStep('s1')],
};

const preview = (line) => {
  const t = (line || '').trim();
  return t ? (t.length > 46 ? `${t.slice(0, 46)}…` : t) : '(no customer line yet)';
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
  const [errField, setErrField] = useState(null);
  const [meta, setMeta] = useState({ scenarioCategories: [], scenarioDifficulties: [], customerMoods: [] });
  const [collapsed, setCollapsed] = useState({}); // key -> true when collapsed
  const [showTest, setShowTest] = useState(false);
  const keyCounter = useRef(2);
  const importRef = useRef(null);

  useEffect(() => { metaApi.get().then((res) => setMeta(res.data)).catch(() => {}); }, []);

  useEffect(() => {
    if (!isEdit) return;
    let ignore = false;
    scenariosApi.get(id)
      .then((res) => {
        if (ignore) return;
        const s = res.data;
        keyCounter.current = s.steps.length + 1;
        setForm({
          title: s.title, description: s.description || '', category: s.category, difficulty: s.difficulty,
          passingScore: s.passingScore, customer: { ...s.customer }, startStep: s.startStep,
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

  const genKey = (taken) => {
    let n = keyCounter.current;
    const set = new Set(taken);
    while (set.has(`s${n}`)) n += 1;
    keyCounter.current = n + 1;
    return `s${n}`;
  };

  const addStep = () => {
    setForm((f) => {
      const key = genKey(f.steps.map((s) => s.key));
      return { ...f, steps: [...f.steps, blankStep(key)] };
    });
  };

  // Create a new step and link this option to it in one go.
  const addFollowUp = (si, oi) => {
    setForm((f) => {
      const key = genKey(f.steps.map((s) => s.key));
      const steps = f.steps.map((s, idx) => (idx === si
        ? { ...s, options: s.options.map((o, j) => (j === oi ? { ...o, nextStep: key } : o)) }
        : s));
      steps.splice(si + 1, 0, blankStep(key));
      return { ...f, steps };
    });
  };

  const removeStep = (i) => {
    setForm((f) => {
      const removed = f.steps[i].key;
      let steps = f.steps.filter((_, idx) => idx !== i)
        .map((s) => ({ ...s, options: s.options.map((o) => (o.nextStep === removed ? { ...o, nextStep: '' } : o)) }));
      const startStep = f.startStep === removed ? (steps[0]?.key || '') : f.startStep;
      return { ...f, steps, startStep };
    });
  };

  const addOption = (si) => form.steps[si].options.length < 4 && setStep(si, { options: [...form.steps[si].options, blankOption()] });
  const removeOption = (si, oi) => form.steps[si].options.length > 2 && setStep(si, { options: form.steps[si].options.filter((_, idx) => idx !== oi) });

  // key -> display index (1-based)
  const keyIndex = useMemo(() => {
    const m = {};
    form.steps.forEach((s, i) => { m[s.key] = i + 1; });
    return m;
  }, [form.steps]);

  // Reachability + flow analysis from the start step.
  const flow = useMemo(() => {
    const byKey = Object.fromEntries(form.steps.map((s) => [s.key, s]));
    const reachable = new Set();
    const queue = [form.startStep];
    while (queue.length) {
      const k = queue.shift();
      if (!byKey[k] || reachable.has(k)) continue;
      reachable.add(k);
      byKey[k].options.forEach((o) => { if (o.nextStep && byKey[o.nextStep]) queue.push(o.nextStep); });
    }
    const unreachable = form.steps.filter((s) => !reachable.has(s.key)).map((s) => s.key);
    const endings = form.steps.filter((s) => s.options.every((o) => !o.nextStep)).map((s) => s.key);
    const hasEnding = form.steps.some((s) => reachable.has(s.key) && s.options.every((o) => !o.nextStep));
    return { reachable, unreachable, endings, hasEnding };
  }, [form.steps, form.startStep]);

  // Greedy best / worst path % (estimate; stops on cycles).
  const scoring = useMemo(() => {
    const byKey = Object.fromEntries(form.steps.map((s) => [s.key, s]));
    const walk = (pick) => {
      let key = form.startStep;
      let total = 0;
      let count = 0;
      const seen = new Set();
      while (byKey[key] && !seen.has(key) && count < 50) {
        seen.add(key);
        const opts = byKey[key].options;
        const chosen = opts.reduce((best, o) => (pick(Number(o.score), Number(best.score)) ? o : best), opts[0]);
        total += Number(chosen.score) || 0;
        count += 1;
        if (!chosen.nextStep) break;
        key = chosen.nextStep;
      }
      return count ? Math.round((total / (count * MAX_STEP_SCORE)) * 100) : 0;
    };
    return { best: walk((a, b) => a > b), worst: walk((a, b) => a < b) };
  }, [form.steps, form.startStep]);

  const validateForm = () => {
    if (!form.title.trim()) return { message: 'Scenario title is required.', field: 'title' };
    if (!form.customer.name.trim()) return { message: 'Customer name is required.', field: 'cname' };
    if (!form.customer.issue.trim()) return { message: 'Customer issue is required.', field: 'cissue' };
    if (form.steps.length === 0) return { message: 'Add at least one step.', field: null };
    for (let i = 0; i < form.steps.length; i += 1) {
      const s = form.steps[i];
      if (!s.customerLine.trim()) return { message: `Step ${i + 1}: customer line is required.`, field: `s${i}line` };
      if (s.options.length < 2 || s.options.length > 4) return { message: `Step ${i + 1}: needs 2-4 options.`, field: null };
      for (let o = 0; o < s.options.length; o += 1) {
        if (!s.options[o].text.trim()) return { message: `Step ${i + 1}, option ${o + 1}: text is required.`, field: `s${i}o${o}` };
      }
    }
    if (!flow.hasEnding) return { message: 'Add at least one ending: a reachable step where every option ends the call.', field: null };
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = validateForm();
    if (problem) {
      setErrField(problem.field);
      if (problem.field) { const m = problem.field.match(/^s(\d+)/); if (m) setCollapsed((c) => ({ ...c, [form.steps[Number(m[1])]?.key]: false })); }
      toast.error(problem.message);
      return;
    }
    if (flow.unreachable.length && !window.confirm(`${flow.unreachable.length} step(s) can't be reached from the start and won't be saved as part of the flow. Save anyway?`)) return;
    setErrField(null);

    const payload = {
      title: form.title.trim(), description: form.description.trim() || undefined,
      category: form.category, difficulty: form.difficulty, passingScore: Number(form.passingScore) || 70,
      customer: { name: form.customer.name.trim(), mood: form.customer.mood, issue: form.customer.issue.trim() },
      startStep: form.startStep,
      steps: form.steps.map((s) => ({
        key: s.key,
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

  const [importing, setImporting] = useState(false);

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const text = await extractFileText(file); // reads .docx / .txt in the browser
      const next = parseScenarioText(text);
      keyCounter.current = next.steps.length + 1;
      setForm(next);
      setErrField(null);
      setCollapsed({});
      toast.success(`Imported "${next.title}" with ${next.steps.length} step(s). Review and save.`);
    } catch (err) {
      toast.error(`Could not import: ${err.message || 'invalid file'}`);
    } finally {
      setImporting(false);
    }
  };

  const exportCurrent = () => {
    downloadScenarioDocx(formToLines(form), `${(form.title || 'scenario').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`);
  };

  if (loading) return <LoadingSpinner />;
  if (loadError) return <EmptyState icon="bi-exclamation-triangle" title="Could not load scenario" message={loadError} action={<Button onClick={() => navigate('/trainer/scenarios')}>Back</Button>} />;

  const moods = meta.customerMoods.length ? meta.customerMoods : ['calm', 'confused', 'frustrated', 'irate'];

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit scenario' : 'New scenario'}
        icon="bi-headset"
        actions={
          <>
            <Dropdown>
              <Dropdown.Toggle variant="light" id="scenario-io" disabled={importing}>
                {importing ? <Spinner size="sm" className="me-1" /> : <i className="bi bi-file-earmark-word me-1" />}Import / Export
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <Dropdown.Item onClick={() => downloadScenarioDocx(TEMPLATE_LINES, 'scenario-template.docx')}><i className="bi bi-download me-2" />Download Word template</Dropdown.Item>
                <Dropdown.Item onClick={() => importRef.current?.click()}><i className="bi bi-upload me-2" />Import Word file…</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={exportCurrent}><i className="bi bi-file-earmark-word me-2" />Export this scenario (.docx)</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
            <input ref={importRef} type="file" accept=".docx,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden onChange={onImportFile} />
            <Button variant="outline-primary" onClick={() => setShowTest(true)}><i className="bi bi-play-circle me-1" />Test run</Button>
            <Button variant="light" onClick={() => navigate('/trainer/scenarios')}><i className="bi bi-arrow-left me-1" />Back</Button>
          </>
        }
      />

      <Form noValidate onSubmit={save}>
        {/* Scenario + customer */}
        <Card className="mb-3">
          <Card.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control value={form.title} onChange={(e) => { setField('title', e.target.value); setErrField(null); }} isInvalid={errField === 'title'} maxLength={150} />
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
                <Form.Control value={form.customer.name} onChange={(e) => { setCustomer('name', e.target.value); setErrField(null); }} isInvalid={errField === 'cname'} />
              </Col>
              <Col md={3} className="mb-3">
                <Form.Label>Mood</Form.Label>
                <Form.Select value={form.customer.mood} onChange={(e) => setCustomer('mood', e.target.value)}>
                  {moods.map((m) => <option key={m} value={m}>{m}</option>)}
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label>Pass mark (%)</Form.Label>
                <Form.Control type="number" min={1} max={100} value={form.passingScore} onChange={(e) => setField('passingScore', e.target.value)} />
              </Col>
              <Col xs={12}>
                <Form.Label>Customer issue</Form.Label>
                <Form.Control value={form.customer.issue} onChange={(e) => { setCustomer('issue', e.target.value); setErrField(null); }} isInvalid={errField === 'cissue'} maxLength={500} />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Flow map + scoring */}
        <Card className="mb-3">
          <Card.Header className="d-flex align-items-center gap-2 flex-wrap">
            <span className="fw-semibold"><i className="bi bi-diagram-3 me-1" />Flow map</span>
            <div className="ms-auto d-flex align-items-center gap-2">
              <span className="small text-muted">Call starts at</span>
              <Form.Select size="sm" style={{ maxWidth: 240 }} value={form.startStep} onChange={(e) => setField('startStep', e.target.value)}>
                {form.steps.map((s, i) => <option key={s.key} value={s.key}>Step {i + 1}: {preview(s.customerLine)}</option>)}
              </Form.Select>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="d-flex flex-wrap gap-3 mb-3 small">
              <span><Badge bg="primary">Pass {form.passingScore}%</Badge></span>
              <span className="text-muted">Best path ~<strong className="text-success">{scoring.best}%</strong></span>
              <span className="text-muted">Worst path ~<strong className="text-danger">{scoring.worst}%</strong></span>
              <span className="text-muted">{form.steps.length} step(s)</span>
            </div>

            {!flow.hasEnding && (
              <div className="alert alert-warning py-2 small mb-2"><i className="bi bi-exclamation-triangle me-1" />No ending yet — add a reachable step where every option “Ends the call”.</div>
            )}
            {flow.unreachable.length > 0 && (
              <div className="alert alert-danger py-2 small mb-2"><i className="bi bi-exclamation-octagon me-1" />Unreachable: {flow.unreachable.map((k) => `Step ${keyIndex[k]}`).join(', ')} — nothing links here.</div>
            )}

            <div className="flow-map">
              {form.steps.map((s, i) => {
                const unreachable = flow.unreachable.includes(s.key);
                const isStart = form.startStep === s.key;
                const isEnd = s.options.every((o) => !o.nextStep);
                return (
                  <div key={s.key} className={`border rounded p-2 mb-2 ${unreachable ? 'border-danger bg-danger-subtle' : ''}`}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="fw-semibold">Step {i + 1}</span>
                      {isStart && <Badge bg="primary">Start</Badge>}
                      {isEnd && <Badge bg="success">Ending</Badge>}
                      {unreachable && <Badge bg="danger">Unreachable</Badge>}
                      <span className="text-muted small text-truncate">{preview(s.customerLine)}</span>
                    </div>
                    <div className="small text-muted ps-2">
                      {s.options.map((o, oi) => (
                        <div key={oi}>
                          <i className="bi bi-arrow-return-right me-1" />
                          {o.text.trim() ? (o.text.length > 34 ? `${o.text.slice(0, 34)}…` : o.text) : `Option ${oi + 1}`}
                          {' '}<span className="text-nowrap">→ {o.nextStep && keyIndex[o.nextStep] ? `Step ${keyIndex[o.nextStep]}` : 'End call'}</span>
                          {' '}<Badge bg="light" text="dark">{o.score}/10</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card.Body>
        </Card>

        {/* Steps */}
        {form.steps.map((s, si) => {
          const isCollapsed = !!collapsed[s.key];
          return (
            <Card className={`mb-3 ${flow.unreachable.includes(s.key) ? 'border-danger' : ''}`} key={s.key}>
              <Card.Header className="d-flex align-items-center gap-2">
                <Button variant="link" className="p-0 text-decoration-none" onClick={() => setCollapsed((c) => ({ ...c, [s.key]: !c[s.key] }))} title={isCollapsed ? 'Expand' : 'Collapse'}>
                  <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down'} me-1`} />
                  <span className="fw-semibold">Step {si + 1}</span>
                </Button>
                {form.startStep === s.key && <Badge bg="primary">Start</Badge>}
                <span className="text-muted small text-truncate d-none d-sm-inline">{preview(s.customerLine)}</span>
                <div className="ms-auto d-flex gap-1">
                  {form.startStep !== s.key && (
                    <Button size="sm" variant="light" onClick={() => setField('startStep', s.key)} title="Make this the start">Set start</Button>
                  )}
                  <Button size="sm" variant="light" className="text-danger" onClick={() => removeStep(si)} disabled={form.steps.length <= 1} title="Remove step"><i className="bi bi-trash" /></Button>
                </div>
              </Card.Header>
              <Collapse in={!isCollapsed}>
                <div>
                  <Card.Body>
                    <Form.Label className="small">Customer says</Form.Label>
                    <Form.Control className="mb-3" as="textarea" rows={2} value={s.customerLine} onChange={(e) => { setStep(si, { customerLine: e.target.value }); setErrField(null); }} isInvalid={errField === `s${si}line`} maxLength={1000} placeholder="What the customer says at this point of the call" />

                    <div className="small fw-semibold mb-2">Agent options (2-4)</div>
                    {s.options.map((o, oi) => (
                      <div key={oi} className="border rounded p-2 mb-2">
                        <Row className="g-2">
                          <Col xs={12}>
                            <Form.Control size="sm" value={o.text} onChange={(e) => { setOpt(si, oi, { text: e.target.value }); setErrField(null); }} isInvalid={errField === `s${si}o${oi}`} placeholder={`Option ${oi + 1} — what the agent says`} maxLength={500} />
                          </Col>
                          <Col sm={3}>
                            <Form.Label className="small mb-0">Score (0-10)</Form.Label>
                            <Form.Control size="sm" type="number" min={0} max={10} value={o.score} onChange={(e) => setOpt(si, oi, { score: e.target.value })} />
                          </Col>
                          <Col sm={5}>
                            <Form.Label className="small mb-0">Then go to</Form.Label>
                            <div className="d-flex gap-1">
                              <Form.Select size="sm" value={o.nextStep} onChange={(e) => setOpt(si, oi, { nextStep: e.target.value })}>
                                <option value="">— End the call —</option>
                                {form.steps.filter((x) => x.key !== s.key).map((x) => <option key={x.key} value={x.key}>Step {keyIndex[x.key]}: {preview(x.customerLine)}</option>)}
                              </Form.Select>
                              <Button size="sm" variant="outline-secondary" onClick={() => addFollowUp(si, oi)} title="Create a new step and link it here"><i className="bi bi-plus-lg" /></Button>
                            </div>
                          </Col>
                          <Col sm={4}>
                            <Form.Label className="small mb-0">Keywords <span className="text-muted">(text &amp; voice match)</span></Form.Label>
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
                </div>
              </Collapse>
            </Card>
          );
        })}

        <div className="d-flex flex-wrap gap-2 mb-5">
          <Button variant="outline-secondary" onClick={addStep}><i className="bi bi-plus-lg me-1" />Add step</Button>
          <Button variant="outline-primary" onClick={() => setShowTest(true)}><i className="bi bi-play-circle me-1" />Test run</Button>
          <Button type="submit" disabled={saving} className="ms-auto">{saving && <Spinner size="sm" className="me-2" />}{isEdit ? 'Save scenario' : 'Create scenario'}</Button>
        </div>
      </Form>

      <TestRunModal show={showTest} onHide={() => setShowTest(false)} form={form} keyIndex={keyIndex} />
    </>
  );
}

/* ---------------- In-place test run (plays the current form, no save) ---------------- */
function TestRunModal({ show, onHide, form, keyIndex }) {
  const byKey = useMemo(() => Object.fromEntries(form.steps.map((s) => [s.key, s])), [form.steps]);
  const [curKey, setCurKey] = useState(form.startStep);
  const [log, setLog] = useState([]); // [{ step, optionText, score, feedback }]
  const [done, setDone] = useState(false);

  const reset = () => { setCurKey(form.startStep); setLog([]); setDone(false); };
  useEffect(() => { if (show) reset(); }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = byKey[curKey];
  const totalScore = log.reduce((sum, e) => sum + e.score, 0);
  const pct = log.length ? Math.round((totalScore / (log.length * MAX_STEP_SCORE)) * 100) : 0;
  const passed = pct >= Number(form.passingScore);

  const choose = (o) => {
    const entry = { stepKey: curKey, optionText: o.text || '(blank)', score: Number(o.score) || 0, feedback: o.feedback };
    setLog((l) => [...l, entry]);
    if (o.nextStep && byKey[o.nextStep]) setCurKey(o.nextStep);
    else setDone(true);
  };

  return (
    <Modal show={show} onHide={onHide} centered scrollable size="lg">
      <Modal.Header closeButton>
        <div>
          <Modal.Title className="h5"><i className="bi bi-play-circle me-1" />Test run</Modal.Title>
          <p className="modal-subtitle">Plays the current scenario (unsaved). Scores are shown for you — agents won’t see them.</p>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 p-2 bg-light rounded small">
          <strong>{form.customer.name || 'Customer'}</strong> <span className="text-muted">({form.customer.mood})</span>
          {form.customer.issue && <> — {form.customer.issue}</>}
        </div>

        {log.map((e, i) => (
          <div key={i} className="mb-2">
            <div className="small text-muted">You said:</div>
            <div className="border rounded p-2">
              <div>{e.optionText} <Badge bg="light" text="dark">{e.score}/10</Badge></div>
              {e.feedback && <div className="small text-muted mt-1"><i className="bi bi-chat-left-text me-1" />{e.feedback}</div>}
            </div>
          </div>
        ))}

        {!done && step && (
          <Card className="mt-2">
            <Card.Body>
              <div className="small text-muted mb-1">Step {keyIndex[curKey]} · customer says:</div>
              <p className="fw-semibold">{step.customerLine || '(no customer line)'}</p>
              <div className="d-grid gap-2">
                {step.options.map((o, oi) => (
                  <Button key={oi} variant="outline-primary" className="text-start" onClick={() => choose(o)}>
                    {o.text || `Option ${oi + 1}`}
                    <span className="float-end text-muted small">→ {o.nextStep && keyIndex[o.nextStep] ? `Step ${keyIndex[o.nextStep]}` : 'End'} · {o.score}/10</span>
                  </Button>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}

        {!done && !step && (
          <div className="alert alert-danger small mb-0">The start step is missing. Pick a valid start step.</div>
        )}

        {done && (
          <Card className={`mt-2 ${passed ? 'border-success' : 'border-danger'}`}>
            <Card.Body className="text-center">
              <div className={`display-6 fw-bold ${passed ? 'text-success' : 'text-danger'}`}>{pct}%</div>
              <div className="mb-1">{passed ? <Badge bg="success">Passed</Badge> : <Badge bg="danger">Below pass mark</Badge>}</div>
              <div className="small text-muted">{totalScore} / {log.length * MAX_STEP_SCORE} points · pass mark {form.passingScore}% · {log.length} step(s)</div>
            </Card.Body>
          </Card>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={reset}><i className="bi bi-arrow-counterclockwise me-1" />Restart</Button>
        <Button onClick={onHide}>Close</Button>
      </Modal.Footer>
    </Modal>
  );
}

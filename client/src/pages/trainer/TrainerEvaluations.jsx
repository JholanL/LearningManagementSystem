/**
 * Trainer → QA Evaluations (scorecards).
 * List the evaluations this trainer wrote (search + acknowledged filter), create/edit
 * in a modal (6 weighted criteria 1-5 → overall %), delete. Locked once the agent
 * acknowledges it. Agents come from the trainer's batches (not /users).
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { batchesApi, evaluationsApi } from '../../api/services';
import { fullName, formatDate, getErrorMessage, getFieldErrors } from '../../utils/helpers';
import { required, validate } from '../../utils/validators';

const CALL_TYPES = ['Inbound', 'Outbound', 'Chat', 'Email'];
const CRITERIA_ORDER = ['greeting', 'empathy', 'productKnowledge', 'resolution', 'compliance', 'closing'];
const emptyScores = () => ({ greeting: 3, empathy: 3, productKnowledge: 3, resolution: 3, compliance: 3, closing: 3 });
const EMPTY = { agent: '', callType: 'Inbound', callSummary: '', scores: emptyScores(), strengths: '', areasForImprovement: '', coachingPlan: '' };

const ratingTone = (rating) =>
  rating === 'Exceeds Expectations' ? 'badge-green' : rating === 'Meets Expectations' ? 'badge-blue' : rating === 'Needs Improvement' ? 'badge-amber' : 'badge-red';

export default function TrainerEvaluations() {
  const toast = useToast();
  const list = usePaginatedList(evaluationsApi.list, { acknowledged: '' });

  const [criteria, setCriteria] = useState({});
  const [agents, setAgents] = useState([]);
  useEffect(() => {
    evaluationsApi.criteria().then((res) => setCriteria(res.data)).catch(() => {});
    // Trainers read agents through their batches, not /users.
    batchesApi
      .list({ limit: 100 })
      .then(async (res) => {
        const all = [];
        for (const b of res.data) {
          // eslint-disable-next-line no-await-in-loop
          const full = await batchesApi.get(b._id);
          (full.data.agents || []).forEach((a) => all.push({ ...a, batchName: b.name }));
        }
        const seen = new Set();
        setAgents(all.filter((a) => (seen.has(a._id) ? false : seen.add(a._id))));
      })
      .catch(() => {});
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => { setEditingId(null); setForm(EMPTY); setErrors({}); setShowForm(true); };

  const openEdit = async (ev) => {
    setEditingId(ev._id);
    setErrors({});
    setShowForm(true);
    try {
      const { data } = await evaluationsApi.get(ev._id);
      setForm({
        agent: data.agent._id,
        callType: data.callType,
        callSummary: data.callSummary,
        scores: { ...emptyScores(), ...data.scores },
        strengths: data.strengths || '',
        areasForImprovement: data.areasForImprovement || '',
        coachingPlan: data.coachingPlan || '',
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setShowForm(false);
    }
  };

  const onChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setErrors({ ...errors, [e.target.name]: undefined }); };
  const setScore = (key, value) => setForm((f) => ({ ...f, scores: { ...f.scores, [key]: Number(value) } }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form, { agent: [required('Agent')], callSummary: [required('Call summary')] });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      if (editingId) await evaluationsApi.update(editingId, form);
      else await evaluationsApi.create(form);
      toast.success(editingId ? 'Evaluation updated.' : 'Evaluation saved.');
      setShowForm(false);
      list.reload();
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
      await evaluationsApi.remove(toDelete._id);
      toast.success('Evaluation deleted.');
      setToDelete(null);
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="QA Evaluations"
        icon="bi-clipboard-check"
        subtitle="Score agents' mock calls across 6 weighted criteria."
        actions={<Button onClick={openCreate}><i className="bi bi-plus-lg me-1" />New evaluation</Button>}
      />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={8}><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by call summary..." /></Col>
            <Col md={4}>
              <Form.Select value={list.filters.acknowledged} onChange={(e) => list.setFilter('acknowledged', e.target.value)} aria-label="Filter by acknowledgment">
                <option value="">All</option>
                <option value="false">Pending acknowledgment</option>
                <option value="true">Acknowledged</option>
              </Form.Select>
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load evaluations" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-clipboard-check" title="No evaluations yet" message="Create a QA scorecard for one of your agents." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr><th>Agent</th><th>Call</th><th className="text-center">Score</th><th>Status</th><th>Date</th><th className="text-end">Actions</th></tr>
                </thead>
                <tbody>
                  {list.items.map((ev) => (
                    <tr key={ev._id}>
                      <td className="fw-semibold">{fullName(ev.agent)}</td>
                      <td className="small text-muted text-truncate" style={{ maxWidth: 260 }}>{ev.callType} · {ev.callSummary}</td>
                      <td className="text-center">
                        <span className={`badge-tone ${ratingTone(ev.rating)}`}>{ev.overallScore}% · {ev.rating}</span>
                      </td>
                      <td>{ev.acknowledged ? <Badge bg="success">Acknowledged</Badge> : <Badge bg="secondary">Pending</Badge>}</td>
                      <td className="small text-nowrap">{formatDate(ev.createdAt)}</td>
                      <td className="text-end text-nowrap">
                        {!ev.acknowledged && <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(ev)} title="Edit"><i className="bi bi-pencil" /></Button>}
                        <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(ev)} title="Delete"><i className="bi bi-trash" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
        </Card.Body>
      </Card>

      {/* Create / Edit modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} size="lg" centered>
        <Form noValidate onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{editingId ? 'Edit evaluation' : 'New evaluation'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="agent">Agent</Form.Label>
                <Form.Select id="agent" name="agent" value={form.agent} onChange={onChange} isInvalid={!!errors.agent} disabled={!!editingId}>
                  <option value="">Select an agent</option>
                  {agents.map((a) => <option key={a._id} value={a._id}>{fullName(a)}{a.batchName ? ` · ${a.batchName}` : ''}</option>)}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.agent}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="callType">Call type</Form.Label>
                <Form.Select id="callType" name="callType" value={form.callType} onChange={onChange}>
                  {CALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Form.Select>
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="callSummary">Call summary</Form.Label>
                <Form.Control id="callSummary" as="textarea" rows={2} name="callSummary" value={form.callSummary} onChange={onChange} isInvalid={!!errors.callSummary} maxLength={1000} />
                <Form.Control.Feedback type="invalid">{errors.callSummary}</Form.Control.Feedback>
              </Col>

              <Col xs={12}><div className="small fw-semibold mb-2">Scores (1-5)</div></Col>
              {CRITERIA_ORDER.map((key) => (
                <Col sm={6} md={4} className="mb-3" key={key}>
                  <Form.Label className="small">{criteria[key]?.label || key}{criteria[key] ? ` · ${criteria[key].weight}%` : ''}</Form.Label>
                  <Form.Select value={form.scores[key]} onChange={(e) => setScore(key, e.target.value)}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Form.Select>
                </Col>
              ))}

              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="strengths">Strengths</Form.Label>
                <Form.Control id="strengths" as="textarea" rows={2} name="strengths" value={form.strengths} onChange={onChange} maxLength={1000} />
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="areasForImprovement">Areas for improvement</Form.Label>
                <Form.Control id="areasForImprovement" as="textarea" rows={2} name="areasForImprovement" value={form.areasForImprovement} onChange={onChange} maxLength={1000} />
              </Col>
              <Col xs={12}>
                <Form.Label htmlFor="coachingPlan">Coaching plan</Form.Label>
                <Form.Control id="coachingPlan" as="textarea" rows={2} name="coachingPlan" value={form.coachingPlan} onChange={onChange} maxLength={1000} />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving && <Spinner size="sm" className="me-2" />}{editingId ? 'Save changes' : 'Save evaluation'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title="Delete evaluation?"
        message={<>Delete this evaluation for <strong>{fullName(toDelete?.agent)}</strong>? This cannot be undone.</>}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

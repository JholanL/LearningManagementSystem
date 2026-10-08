/**
 * Trainer endorsement modal (feature 5): shows the eligibility checklist + metrics
 * snapshot for an agent, and lets the trainer submit an endorsement if eligible.
 */
import { useEffect, useState } from 'react';
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import { endorsementsApi } from '../api/services';
import { getErrorMessage } from '../utils/helpers';
import { useToast } from '../context/ToastContext';

export default function EndorsementModal({ agent, show, onHide, onDone }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); // { eligible, checklist, snapshot }
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show || !agent) return;
    setLoading(true);
    setError('');
    setData(null);
    setNote('');
    endorsementsApi
      .eligibility(agent.id)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [show, agent]);

  const submit = async () => {
    setSaving(true);
    try {
      await endorsementsApi.create(agent.id, note);
      toast.success('Endorsement submitted for admin approval.');
      onDone?.();
      onHide();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const snap = data?.snapshot;

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <div>
          <Modal.Title className="h5">Endorse for production</Modal.Title>
          <p className="modal-subtitle">{agent?.name}</p>
        </div>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" /></div>
        ) : error ? (
          <div className="text-danger small">{error}</div>
        ) : data ? (
          <>
            <ul className="checklist mb-3">
              {data.checklist.map((c) => (
                <li key={c.key} className={c.passed ? 'ok' : 'fail'}>
                  <i className={`bi ${c.passed ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />
                  <span>{c.rule}</span>
                  <span className="small text-muted ms-auto">{c.detail}</span>
                </li>
              ))}
            </ul>

            {snap && (
              <Row className="g-2 text-center mb-3">
                <Col xs={4}><div className="score-tile"><div className="score-num">{snap.readinessScore}</div><div className="score-lbl">Readiness</div></div></Col>
                <Col xs={4}><div className="score-tile"><div className="score-num">{snap.overallPercent}%</div><div className="score-lbl">Overall</div></div></Col>
                <Col xs={4}><div className="score-tile"><div className="score-num">{snap.coursesCompleted}/{snap.totalCourses}</div><div className="score-lbl">Courses</div></div></Col>
              </Row>
            )}

            {data.eligible ? (
              <Form.Group>
                <Form.Label htmlFor="note">Note to admin <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control id="note" as="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Why this agent is ready..." />
              </Form.Group>
            ) : (
              <div className="small text-muted"><i className="bi bi-info-circle me-1" />Resolve the red items above before endorsing.</div>
            )}
          </>
        ) : null}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="light" onClick={onHide} disabled={saving}>Cancel</Button>
        <Button onClick={submit} disabled={saving || !data?.eligible}>
          {saving && <Spinner size="sm" className="me-2" />}
          Submit endorsement
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

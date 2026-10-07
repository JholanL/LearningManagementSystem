import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';
import api, { getErrorMessage } from '../../../api/axios';
import { ASSIGNMENT_LIMITS } from '../../../constants/courses';
import { fromDateTimeInput, toDateTimeInput } from '../../../utils/format';

const EMPTY = { title: '', instructions: '', dueDate: '', points: '100' };

const validate = ({ title, instructions, points }) => {
  const errors = {};
  if (!title.trim()) errors.title = 'Enter an assignment title';
  else if (title.trim().length > ASSIGNMENT_LIMITS.title)
    errors.title = `Title must be at most ${ASSIGNMENT_LIMITS.title} characters`;
  if (instructions.trim().length > ASSIGNMENT_LIMITS.instructions)
    errors.instructions = `Instructions must be at most ${ASSIGNMENT_LIMITS.instructions} characters`;
  const n = Number(points);
  if (!Number.isInteger(n) || n < 1 || n > ASSIGNMENT_LIMITS.maxPoints)
    errors.points = `Use a whole number from 1 to ${ASSIGNMENT_LIMITS.maxPoints}`;
  return errors;
};

// Adds an assignment, or edits `assignment` when one is given.
export default function AssignmentModal({ show, courseId, assignment, onHide, onSaved }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setErrors({});
    setServerError('');
    setValues(
      assignment
        ? {
            title: assignment.title,
            instructions: assignment.instructions || '',
            dueDate: toDateTimeInput(assignment.dueDate),
            points: String(assignment.points),
          }
        : EMPTY
    );
  }, [show, assignment]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      title: values.title.trim(),
      instructions: values.instructions.trim(),
      dueDate: fromDateTimeInput(values.dueDate),
      points: Number(values.points),
    };

    setSaving(true);
    try {
      if (assignment) {
        await api.put(`/assignments/${assignment.id}`, payload);
      } else {
        await api.post(`/courses/${courseId}/assignments`, payload);
      }
      onSaved();
      onHide();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={saving ? undefined : onHide} size="lg" centered>
      <Form noValidate onSubmit={handleSubmit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title className="fs-5 fw-bold">
            {assignment ? 'Edit assignment' : 'New assignment'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {serverError && <Alert variant="danger">{serverError}</Alert>}

          <Form.Group className="mb-3" controlId="assignment-title">
            <Form.Label>Title</Form.Label>
            <Form.Control
              name="title"
              value={values.title}
              onChange={handleChange}
              isInvalid={Boolean(errors.title)}
            />
            <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
          </Form.Group>

          <Form.Group className="mb-3" controlId="assignment-instructions">
            <Form.Label>Instructions</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              name="instructions"
              value={values.instructions}
              onChange={handleChange}
              isInvalid={Boolean(errors.instructions)}
            />
            <Form.Control.Feedback type="invalid">{errors.instructions}</Form.Control.Feedback>
          </Form.Group>

          <Row className="g-3">
            <Form.Group as={Col} sm={8} controlId="assignment-due">
              <Form.Label>Due date (optional)</Form.Label>
              <Form.Control
                type="datetime-local"
                name="dueDate"
                value={values.dueDate}
                onChange={handleChange}
              />
              <Form.Text>Students can still submit after this; their work is marked late.</Form.Text>
            </Form.Group>
            <Form.Group as={Col} sm={4} controlId="assignment-points">
              <Form.Label>Points</Form.Label>
              <Form.Control
                type="number"
                min={1}
                max={ASSIGNMENT_LIMITS.maxPoints}
                name="points"
                value={values.points}
                onChange={handleChange}
                isInvalid={Boolean(errors.points)}
              />
              <Form.Control.Feedback type="invalid">{errors.points}</Form.Control.Feedback>
            </Form.Group>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-primary" onClick={onHide} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : assignment ? 'Save assignment' : 'Create assignment'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

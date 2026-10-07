import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { getErrorMessage } from '../../../api/axios';
import { COURSE_CATEGORIES, COURSE_LIMITS } from '../../../constants/courses';

const EMPTY = { title: '', code: '', category: '', description: '', status: 'draft' };

const validate = ({ title, code, description }) => {
  const errors = {};
  if (!title.trim()) errors.title = 'Enter a course title';
  else if (title.trim().length > COURSE_LIMITS.title)
    errors.title = `Title must be at most ${COURSE_LIMITS.title} characters`;
  if (code.trim().length > COURSE_LIMITS.code)
    errors.code = `Code must be at most ${COURSE_LIMITS.code} characters`;
  if (!description.trim()) errors.description = 'Enter a short description';
  else if (description.trim().length > COURSE_LIMITS.description)
    errors.description = `Description must be at most ${COURSE_LIMITS.description} characters`;
  return errors;
};

// Used to create a course and to edit one. `onSubmit` receives the cleaned values.
export default function CourseForm({ initialValues, submitLabel, savedText, onSubmit, onCancel }) {
  const [values, setValues] = useState({ ...EMPTY, ...initialValues });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Keep a category that is not in the list (e.g. typed through the API) selectable.
  const categories =
    values.category && !COURSE_CATEGORIES.includes(values.category)
      ? [values.category, ...COURSE_CATEGORIES]
      : COURSE_CATEGORIES;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSaved(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    setSaved(false);

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        title: values.title.trim(),
        code: values.code.trim(),
        category: values.category,
        description: values.description.trim(),
        status: values.status,
      });
      setSaved(true);
    } catch (error) {
      setServerError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form noValidate onSubmit={handleSubmit}>
      {serverError && <Alert variant="danger">{serverError}</Alert>}
      {saved && savedText && <Alert variant="success">{savedText}</Alert>}

      <Form.Group className="mb-3" controlId="course-title">
        <Form.Label>Title</Form.Label>
        <Form.Control
          name="title"
          value={values.title}
          onChange={handleChange}
          isInvalid={Boolean(errors.title)}
          placeholder="e.g. Advanced Web Programming"
        />
        <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
      </Form.Group>

      <Row className="g-3 mb-3">
        <Form.Group as={Col} sm={4} controlId="course-code">
          <Form.Label>Course code (optional)</Form.Label>
          <Form.Control
            name="code"
            value={values.code}
            onChange={handleChange}
            isInvalid={Boolean(errors.code)}
            placeholder="e.g. WEB 301"
          />
          <Form.Control.Feedback type="invalid">{errors.code}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group as={Col} sm={8} controlId="course-category">
          <Form.Label>Category</Form.Label>
          <Form.Select name="category" value={values.category} onChange={handleChange}>
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      </Row>

      <Form.Group className="mb-3" controlId="course-description">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={5}
          name="description"
          value={values.description}
          onChange={handleChange}
          isInvalid={Boolean(errors.description)}
        />
        <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
        <Form.Text className="d-block text-end">
          {values.description.trim().length} / {COURSE_LIMITS.description} characters
        </Form.Text>
      </Form.Group>

      <fieldset className="mb-4">
        <legend className="form-label">Visibility</legend>
        <Row className="g-3">
          {[
            { value: 'draft', label: 'Draft, hidden from students' },
            { value: 'published', label: 'Published, students can join' },
          ].map((option) => (
            <Col sm={6} key={option.value}>
              <label
                className={`lms-choice ${values.status === option.value ? 'lms-choice--checked' : ''}`}
              >
                <input
                  type="radio"
                  className="form-check-input m-0"
                  name="status"
                  value={option.value}
                  checked={values.status === option.value}
                  onChange={handleChange}
                />
                {option.label}
              </label>
            </Col>
          ))}
        </Row>
      </fieldset>

      <div className="d-flex gap-2 justify-content-end">
        {onCancel && (
          <Button variant="outline-primary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </Form>
  );
}

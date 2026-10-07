import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import { Link, useLocation } from 'react-router-dom';
import { getErrorMessage } from '../api/axios';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'instructor', label: 'Instructor' },
];

// Same rules the API enforces, checked here first for faster feedback.
const validate = ({ name, email, password, confirmPassword }) => {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your full name';
  else if (name.trim().length > 100) errors.name = 'Name must be at most 100 characters';
  if (!EMAIL_REGEX.test(email.trim())) errors.email = 'Enter a valid email address';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
  return errors;
};

export default function Register() {
  const { register } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    setSubmitting(true);
    try {
      // GuestRoute redirects as soon as the user is set.
      await register({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      });
    } catch (error) {
      setServerError(getErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      heading="Join as a student or an instructor."
      text="Admin accounts are not open for sign-up. They are created by an existing admin."
    >
      <h2 className="font-display fs-1 mb-4">Create an account</h2>

      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <Form noValidate onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="register-name">
          <Form.Label>Full name</Form.Label>
          <Form.Control
            type="text"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={handleChange}
            isInvalid={Boolean(errors.name)}
          />
          <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-3" controlId="register-email">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            autoComplete="email"
            value={values.email}
            onChange={handleChange}
            isInvalid={Boolean(errors.email)}
          />
          <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
        </Form.Group>

        <Row className="g-3 mb-3">
          <Form.Group as={Col} sm={6} controlId="register-password">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              autoComplete="new-password"
              value={values.password}
              onChange={handleChange}
              isInvalid={Boolean(errors.password)}
            />
            <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
            {!errors.password && <Form.Text>At least 8 characters</Form.Text>}
          </Form.Group>

          <Form.Group as={Col} sm={6} controlId="register-confirm">
            <Form.Label>Confirm password</Form.Label>
            <Form.Control
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={handleChange}
              isInvalid={Boolean(errors.confirmPassword)}
            />
            <Form.Control.Feedback type="invalid">{errors.confirmPassword}</Form.Control.Feedback>
          </Form.Group>
        </Row>

        <fieldset className="mb-4">
          <legend className="form-label">I am signing up as</legend>
          <Row className="g-3">
            {ROLE_OPTIONS.map((option) => (
              <Col xs={6} key={option.value}>
                <label
                  className={`lms-choice ${
                    values.role === option.value ? 'lms-choice--checked' : ''
                  }`}
                >
                  <input
                    type="radio"
                    className="form-check-input m-0"
                    name="role"
                    value={option.value}
                    checked={values.role === option.value}
                    onChange={handleChange}
                  />
                  {option.label}
                </label>
              </Col>
            ))}
          </Row>
        </fieldset>

        <Button type="submit" size="lg" className="w-100" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Form>

      <p className="text-body-secondary text-center mt-4 mb-0">
        Already registered?{' '}
        <Link to="/login" state={location.state} className="fw-semibold">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

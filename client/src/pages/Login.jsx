import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { Link, useLocation } from 'react-router-dom';
import { getErrorMessage } from '../api/axios';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ email, password }) => {
  const errors = {};
  if (!EMAIL_REGEX.test(email.trim())) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Enter your password';
  return errors;
};

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
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
      await login(values.email.trim(), values.password);
    } catch (error) {
      setServerError(getErrorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      heading="Pick up where you left off."
      text="Your lessons, deadlines, and grades are waiting on your dashboard."
    >
      <h2 className="font-display fs-1 mb-1">Log in</h2>
      <p className="text-body-secondary mb-4">Use the email and password you registered with.</p>

      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <Form noValidate onSubmit={handleSubmit}>
        <Form.Group className="mb-3" controlId="login-email">
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

        <Form.Group className="mb-4" controlId="login-password">
          <Form.Label>Password</Form.Label>
          <Form.Control
            type="password"
            name="password"
            autoComplete="current-password"
            value={values.password}
            onChange={handleChange}
            isInvalid={Boolean(errors.password)}
          />
          <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
        </Form.Group>

        <Button type="submit" size="lg" className="w-100" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </Form>

      <p className="text-body-secondary text-center mt-4 mb-0">
        No account yet?{' '}
        <Link to="/register" state={location.state} className="fw-semibold">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

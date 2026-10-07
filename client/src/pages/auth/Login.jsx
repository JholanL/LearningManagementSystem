import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, InputGroup, Spinner } from 'react-bootstrap';
import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, ROLE_HOME } from '../../utils/helpers';
import { isEmail, required, validate } from '../../utils/validators';

// Quick-fill buttons for the demo/presentation (seed accounts).
// Shown in development, or when VITE_SHOW_DEMO_ACCOUNTS=true
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@voicelink.ph', password: 'Admin@123' },
  { label: 'Trainer', email: 'maria.santos@voicelink.ph', password: 'Trainer@123' },
  { label: 'Agent', email: 'juan.delacruz@voicelink.ph', password: 'Agent@123' },
];
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

export default function Login() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form, {
      email: [required('Email'), [isEmail, 'Enter a valid email']],
      password: [required('Password')],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setServerError('');
    try {
      const user = await login(form.email.trim(), form.password);
      // Go back to the page they originally wanted (if it belongs to their role)
      const from = location.state?.from?.pathname;
      navigate(from && from.startsWith(ROLE_HOME[user.role]) ? from : ROLE_HOME[user.role], { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to continue your training.">
      {sessionMessage && !serverError && <Alert variant="warning">{sessionMessage}</Alert>}
      {serverError && <Alert variant="danger">{serverError}</Alert>}

      <Form noValidate onSubmit={onSubmit}>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>Email</Form.Label>
          <Form.Control
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            isInvalid={!!errors.email}
            placeholder="you@voicelink.ph"
            autoComplete="email"
            autoFocus
          />
          <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
        </Form.Group>

        <Form.Group className="mb-4" controlId="password">
          <Form.Label>Password</Form.Label>
          <InputGroup hasValidation>
            <Form.Control
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={onChange}
              isInvalid={!!errors.password}
              autoComplete="current-password"
            />
            <Button variant="outline-secondary" onClick={() => setShowPassword((s) => !s)} aria-label="Toggle password visibility">
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
            </Button>
            <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>

        <Button type="submit" className="w-100 py-2" disabled={submitting}>
          {submitting && <Spinner size="sm" className="me-2" />}
          Log in
        </Button>
      </Form>

      <p className="text-center text-muted small mt-4 mb-0">
        New hire? <Link to="/register">Create an agent account</Link>
      </p>

      {SHOW_DEMO && (
        <div className="demo-accounts mt-4">
          <div className="small text-muted mb-2">
            <i className="bi bi-lightning-charge me-1" />
            Demo accounts
          </div>
          <div className="d-flex gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <Button key={a.label} size="sm" variant="outline-primary" className="flex-fill" onClick={() => setForm({ email: a.email, password: a.password })}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

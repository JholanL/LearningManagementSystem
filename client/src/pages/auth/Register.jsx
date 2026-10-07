import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Col, Form, Row, Spinner } from 'react-bootstrap';
import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getErrorMessage, getFieldErrors } from '../../utils/helpers';
import { isEmail, isName, isPhPhone, passwordIssues, required, validate } from '../../utils/validators';

const EMPTY = { firstName: '', lastName: '', email: '', employeeId: '', phone: '', password: '', confirmPassword: '' };

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const pwIssues = passwordIssues(form.password);

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form, {
      firstName: [required('First name'), [isName, 'Letters only, max 50']],
      lastName: [required('Last name'), [isName, 'Letters only, max 50']],
      email: [required('Email'), [isEmail, 'Enter a valid email']],
      employeeId: [[(v) => !v || /^[A-Za-z0-9-]{3,20}$/.test(v), '3-20 letters, numbers or dashes']],
      phone: [[isPhPhone, 'Use 09XXXXXXXXX format']],
      password: [required('Password'), [(v) => passwordIssues(v).length === 0, 'Password does not meet the requirements']],
      confirmPassword: [required('Confirm password'), [(v, all) => v === all.password, 'Passwords do not match']],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    setServerError('');
    try {
      await register(form);
      toast.success('Welcome to VoiceLink Academy!');
      navigate('/agent', { replace: true });
    } catch (err) {
      setErrors(getFieldErrors(err));
      setServerError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (name, label, props = {}) => (
    <Form.Group className="mb-3" controlId={name}>
      <Form.Label>{label}</Form.Label>
      <Form.Control name={name} value={form[name]} onChange={onChange} isInvalid={!!errors[name]} {...props} />
      <Form.Control.Feedback type="invalid">{errors[name]}</Form.Control.Feedback>
    </Form.Group>
  );

  return (
    <AuthLayout title="Create your account" subtitle="For new-hire agents. Your trainer will assign you to a batch.">
      {serverError && <Alert variant="danger">{serverError}</Alert>}
      <Form noValidate onSubmit={onSubmit}>
        <Row>
          <Col sm={6}>{field('firstName', 'First name', { autoComplete: 'given-name' })}</Col>
          <Col sm={6}>{field('lastName', 'Last name', { autoComplete: 'family-name' })}</Col>
        </Row>
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        <Row>
          <Col sm={6}>{field('employeeId', 'Employee ID (optional)', { placeholder: 'VL-2010' })}</Col>
          <Col sm={6}>{field('phone', 'Mobile (optional)', { placeholder: '09XXXXXXXXX', inputMode: 'tel' })}</Col>
        </Row>
        {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
        {form.password && (
          <ul className="password-rules small mb-3">
            {['at least 8 characters', 'an uppercase letter', 'a lowercase letter', 'a number'].map((rule) => (
              <li key={rule} className={pwIssues.includes(rule) ? 'text-muted' : 'text-success'}>
                <i className={`bi ${pwIssues.includes(rule) ? 'bi-circle' : 'bi-check-circle-fill'} me-1`} />
                {rule}
              </li>
            ))}
          </ul>
        )}
        {field('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}

        <Button type="submit" className="w-100 py-2 mt-2" disabled={submitting}>
          {submitting && <Spinner size="sm" className="me-2" />}
          Create account
        </Button>
      </Form>
      <p className="text-center text-muted small mt-4 mb-0">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}

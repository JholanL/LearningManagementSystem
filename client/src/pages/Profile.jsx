import { useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import api, { getErrorMessage } from '../api/axios';
import { ROLE_LABELS } from '../components/navItems';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../utils/format';

function AccountForm() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!name.trim()) return setError('Enter your name');
    if (name.trim().length > 100) return setError('Name must be at most 100 characters');

    setSaving(true);
    try {
      const { data } = await api.put('/auth/me', { name: name.trim() });
      setUser(data.user);
      setMessage('Your name was updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form noValidate onSubmit={handleSubmit} className="lms-card p-4">
      <h2 className="fs-5 fw-bold mb-3">Account details</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Row className="g-3 mb-3">
        <Form.Group as={Col} md={6} controlId="profile-name">
          <Form.Label>Full name</Form.Label>
          <Form.Control value={name} onChange={(event) => setName(event.target.value)} />
        </Form.Group>
        <Form.Group as={Col} md={6} controlId="profile-email">
          <Form.Label>Email</Form.Label>
          <Form.Control value={user.email} disabled />
          <Form.Text>Email cannot be changed here.</Form.Text>
        </Form.Group>
      </Row>
      <div className="text-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Form>
  );
}

function PasswordForm() {
  const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    setMessage('');

    const found = {};
    if (!values.currentPassword) found.currentPassword = 'Enter your current password';
    if (values.newPassword.length < 8) found.newPassword = 'Use at least 8 characters';
    if (values.confirmPassword !== values.newPassword)
      found.confirmPassword = 'Passwords do not match';
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      await api.put('/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setValues(EMPTY);
      setMessage('Your password was changed.');
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form noValidate onSubmit={handleSubmit} className="lms-card p-4">
      <h2 className="fs-5 fw-bold mb-3">Change password</h2>
      {serverError && <Alert variant="danger">{serverError}</Alert>}
      {message && <Alert variant="success">{message}</Alert>}
      <Form.Group className="mb-3" controlId="profile-current-password" style={{ maxWidth: 360 }}>
        <Form.Label>Current password</Form.Label>
        <Form.Control
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          value={values.currentPassword}
          onChange={handleChange}
          isInvalid={Boolean(errors.currentPassword)}
        />
        <Form.Control.Feedback type="invalid">{errors.currentPassword}</Form.Control.Feedback>
      </Form.Group>
      <Row className="g-3 mb-3">
        <Form.Group as={Col} md={6} controlId="profile-new-password">
          <Form.Label>New password</Form.Label>
          <Form.Control
            type="password"
            name="newPassword"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={handleChange}
            isInvalid={Boolean(errors.newPassword)}
          />
          <Form.Control.Feedback type="invalid">{errors.newPassword}</Form.Control.Feedback>
          {!errors.newPassword && <Form.Text>At least 8 characters</Form.Text>}
        </Form.Group>
        <Form.Group as={Col} md={6} controlId="profile-confirm-password">
          <Form.Label>Confirm new password</Form.Label>
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
      <div className="text-end">
        <Button type="submit" variant="outline-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Update password'}
        </Button>
      </div>
    </Form>
  );
}

// Shared by every role.
export default function Profile() {
  const { user } = useAuth();

  return (
    <>
      <h1 className="font-display fs-2 mb-4">My profile</h1>
      <Row className="g-4 align-items-start">
        <Col lg={4}>
          <div className="lms-card p-4 text-center">
            <div
              className="lms-avatar mx-auto mb-3 font-display"
              style={{ width: 96, height: 96, fontSize: '2.25rem' }}
            >
              {getInitials(user.name)}
            </div>
            <div className="fw-bold fs-5">{user.name}</div>
            <div className="small text-body-secondary mb-2">{user.email}</div>
            <span className="lms-pill">{ROLE_LABELS[user.role]}</span>
          </div>
        </Col>
        <Col lg={8} className="d-flex flex-column gap-4">
          <AccountForm />
          <PasswordForm />
        </Col>
      </Row>
    </>
  );
}

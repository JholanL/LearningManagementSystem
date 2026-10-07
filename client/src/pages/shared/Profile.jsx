import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/services';
import { formatDate, formatDateTime, fullName, getErrorMessage, getFieldErrors, initials } from '../../utils/helpers';
import { isName, isPhPhone, isUrl, passwordIssues, required, validate } from '../../utils/validators';

// Shared by all roles: view info, edit profile, change password
export default function Profile() {
  const { user, setUser, replaceToken } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
  });
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [pwServerError, setPwServerError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    const found = validate(profile, {
      firstName: [required('First name'), [isName, 'Letters only, max 50']],
      lastName: [required('Last name'), [isName, 'Letters only, max 50']],
      phone: [[isPhPhone, 'Use 09XXXXXXXXX format']],
      avatarUrl: [[isUrl, 'Must start with http:// or https://']],
    });
    setProfileErrors(found);
    if (Object.keys(found).length) return;

    setSavingProfile(true);
    try {
      const res = await authApi.updateMe(profile);
      setUser(res.user);
      toast.success('Profile updated.');
    } catch (err) {
      setProfileErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const found = validate(pw, {
      currentPassword: [required('Current password')],
      newPassword: [required('New password'), [(v) => passwordIssues(v).length === 0, `Needs ${passwordIssues(pw.newPassword).join(', ')}`]],
      confirmPassword: [[(v, all) => v === all.newPassword, 'Passwords do not match']],
    });
    setPwErrors(found);
    setPwServerError('');
    if (Object.keys(found).length) return;

    setSavingPw(true);
    try {
      const res = await authApi.changePassword({ currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      replaceToken(res.token); // old tokens are now invalid
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed. Other devices were logged out.');
    } catch (err) {
      setPwErrors(getFieldErrors(err));
      setPwServerError(getErrorMessage(err));
    } finally {
      setSavingPw(false);
    }
  };

  const onProfile = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const onPw = (e) => setPw({ ...pw, [e.target.name]: e.target.value });

  return (
    <>
      <PageHeader title="My Profile" icon="bi-person-circle" subtitle="Manage your personal information and password." />
      <Row className="g-4">
        <Col lg={4}>
          <Card className="h-100 text-center">
            <Card.Body className="p-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="avatar avatar-xl mb-3" />
              ) : (
                <span className="avatar avatar-initials avatar-xl mb-3">{initials(user)}</span>
              )}
              <h2 className="h5 fw-bold mb-1">{fullName(user)}</h2>
              <p className="text-muted small mb-2">{user.email}</p>
              <StatusBadge status={user.role} />
              <hr />
              <dl className="profile-meta text-start small mb-0">
                <dt>Employee ID</dt>
                <dd>{user.employeeId || '-'}</dd>
                {user.role === 'agent' && (
                  <>
                    <dt>Batch</dt>
                    <dd>{user.batch ? `${user.batch.name} · ${user.batch.account}` : 'Not assigned yet'}</dd>
                  </>
                )}
                <dt>Member since</dt>
                <dd>{formatDate(user.createdAt)}</dd>
                <dt>Last login</dt>
                <dd>{formatDateTime(user.lastLogin)}</dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header className="fw-semibold">Personal information</Card.Header>
            <Card.Body>
              <Form noValidate onSubmit={saveProfile}>
                <Row>
                  <Col md={6} className="mb-3">
                    <Form.Label htmlFor="firstName">First name</Form.Label>
                    <Form.Control id="firstName" name="firstName" value={profile.firstName} onChange={onProfile} isInvalid={!!profileErrors.firstName} />
                    <Form.Control.Feedback type="invalid">{profileErrors.firstName}</Form.Control.Feedback>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label htmlFor="lastName">Last name</Form.Label>
                    <Form.Control id="lastName" name="lastName" value={profile.lastName} onChange={onProfile} isInvalid={!!profileErrors.lastName} />
                    <Form.Control.Feedback type="invalid">{profileErrors.lastName}</Form.Control.Feedback>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label htmlFor="phone">Mobile number</Form.Label>
                    <Form.Control id="phone" name="phone" value={profile.phone} onChange={onProfile} isInvalid={!!profileErrors.phone} placeholder="09XXXXXXXXX" />
                    <Form.Control.Feedback type="invalid">{profileErrors.phone}</Form.Control.Feedback>
                  </Col>
                  <Col md={6} className="mb-3">
                    <Form.Label htmlFor="avatarUrl">Photo URL</Form.Label>
                    <Form.Control id="avatarUrl" name="avatarUrl" value={profile.avatarUrl} onChange={onProfile} isInvalid={!!profileErrors.avatarUrl} placeholder="https://..." />
                    <Form.Control.Feedback type="invalid">{profileErrors.avatarUrl}</Form.Control.Feedback>
                  </Col>
                </Row>
                <Form.Text className="d-block mb-3">Email, role and batch can only be changed by an administrator.</Form.Text>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile && <Spinner size="sm" className="me-2" />}
                  Save changes
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className="fw-semibold">Change password</Card.Header>
            <Card.Body>
              {pwServerError && <Alert variant="danger">{pwServerError}</Alert>}
              <Form noValidate onSubmit={changePassword}>
                <Row>
                  {[
                    ['currentPassword', 'Current password', 'current-password'],
                    ['newPassword', 'New password', 'new-password'],
                    ['confirmPassword', 'Confirm new password', 'new-password'],
                  ].map(([name, label, ac]) => (
                    <Col md={4} className="mb-3" key={name}>
                      <Form.Label htmlFor={name}>{label}</Form.Label>
                      <Form.Control id={name} type="password" name={name} value={pw[name]} onChange={onPw} isInvalid={!!pwErrors[name]} autoComplete={ac} />
                      <Form.Control.Feedback type="invalid">{pwErrors[name]}</Form.Control.Feedback>
                    </Col>
                  ))}
                </Row>
                <Button type="submit" variant="outline-primary" disabled={savingPw}>
                  {savingPw && <Spinner size="sm" className="me-2" />}
                  Update password
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { batchesApi, usersApi } from '../../api/services';
import { formatDate, fullName, getErrorMessage, getFieldErrors } from '../../utils/helpers';
import { buildCompanyEmail } from '../../utils/companyEmail';
import { isEmail, isName, passwordIssues, required, validate } from '../../utils/validators';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', password: '', role: 'agent', employeeId: '', phone: '', batch: '' };
const ROLE_OPTIONS = ['trainer', 'agent'];
const ROLE_FILTERS = ['admin', 'trainer', 'agent'];
const isAdminPhPhone = (value) => /^09[0-9]{9}$/.test(String(value).trim());

function cleanOptional(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== '' && value !== undefined));
}

function buildUpdate(original, form) {
  const updates = {};
  Object.keys(form).forEach((key) => {
    if (key === 'employeeId' || key === 'email') return;
    if (key === 'password' && !form.password) return;
    const nextValue = key === 'batch' && form.role === 'agent' && !form.batch ? null : form[key];
    if (nextValue !== original[key]) updates[key] = nextValue;
  });
  return updates;
}

export default function ManageUsers() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const list = usePaginatedList(usersApi.list, { role: '', isActive: '', batch: '' });
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  useEffect(() => {
    if (initialSearch) list.setSearch(initialSearch);
    // Apply a global-search deep link once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch]);

  const [batches, setBatches] = useState([]);
  const [batchesLoading, setBatchesLoading] = useState(true);
  useEffect(() => {
    batchesApi.list({ limit: 100 })
      .then((res) => setBatches(res.data || []))
      .catch(() => {})
      .finally(() => setBatchesLoading(false));
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toDeactivate, setToDeactivate] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [unlockingId, setUnlockingId] = useState(null);
  const [hiddenUnlockIds, setHiddenUnlockIds] = useState(() => new Set());

  useEffect(() => {
    if (!list.items.length) return;
    setHiddenUnlockIds((current) => {
      const next = new Set(current);
      list.items.forEach((account) => {
        if (!account.isLoginLocked) next.delete(account._id);
      });
      return next.size === current.size ? current : next;
    });
  }, [list.items]);

  useEffect(() => {
    if (!list.items.some((account) => account.isLoginLocked)) return undefined;
    const refreshTimer = window.setInterval(list.reload, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [list.items, list.reload]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOriginalForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = async (account) => {
    setEditingId(account._id);
    setErrors({});
    setShowForm(true);
    setLoadingUser(true);
    try {
      const { data } = await usersApi.get(account._id);
      const loaded = {
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        email: data.email || '',
        password: '',
        role: data.role || 'agent',
        employeeId: data.employeeId || '',
        phone: data.phone || '',
        batch: data.batch?._id || '',
      };
      setForm(loaded);
      setOriginalForm(loaded);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setShowForm(false);
    } finally {
      setLoadingUser(false);
    }
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    const nextValue = value;
    setForm((current) => {
      const nextForm = { ...current, [name]: nextValue, ...(name === 'role' && value !== 'agent' ? { batch: '' } : {}) };
      if (!editingId && (name === 'firstName' || name === 'lastName')) {
        nextForm.email = buildCompanyEmail(nextForm.firstName, nextForm.lastName);
      }
      return nextForm;
    });
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validateForm = () => {
    const rules = {
      firstName: [required('First name'), [isName, 'First name contains invalid characters']],
      lastName: [required('Last name'), [isName, 'Last name contains invalid characters']],
      role: [required('Role')],
    };
    if (!editingId) rules.email = [required('Email'), [isEmail, 'Enter a valid email address']];
    if (!editingId) rules.phone = [required('Phone number'), [isAdminPhPhone, 'Phone number must start with 09 and contain exactly 11 digits.']];
    else if (form.phone !== originalForm.phone && form.phone) rules.phone = [[isAdminPhPhone, 'Phone number must start with 09 and contain exactly 11 digits.']];
    if (!editingId || form.password) {
      rules.password = [required('Password'), [(value) => passwordIssues(value).length === 0, `Password needs ${passwordIssues(form.password).join(', ')}`]];
    }
    return validate(form, rules);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validateForm();
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (editingId) {
        const updates = buildUpdate(originalForm, form);
        if (Object.keys(updates).length === 0) {
          setShowForm(false);
          return;
        }
        await usersApi.update(editingId, updates);
        toast.success('User updated.');
      } else {
        const data = cleanOptional({ ...form });
        delete data.employeeId;
        delete data.email;
        if (data.role !== 'agent') delete data.batch;
        const response = await usersApi.create(data);
        toast.success(`User created. Employee ID: ${response.data?.employeeId || 'generated by server'}.`);
      }
      setShowForm(false);
      list.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (account) => {
    setChangingStatus(true);
    try {
      await usersApi.toggleStatus(account._id);
      toast.success(`${fullName(account)} ${account.isActive ? 'deactivated' : 'activated'}.`);
      setToDeactivate(null);
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setChangingStatus(false);
    }
  };

  const requestStatusChange = (account) => {
    if (String(account._id) === String(currentUser?._id)) return;
    if (account.isActive) setToDeactivate(account);
    else changeStatus(account);
  };

  const unlock = async (account) => {
    setUnlockingId(account._id);
    try {
      await usersApi.unlock(account._id);
      toast.success(`Login lock cleared for ${fullName(account)}.`);
      setHiddenUnlockIds((current) => new Set(current).add(account._id));
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUnlockingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await usersApi.remove(toDelete._id);
      toast.success(`${fullName(toDelete)} deleted.`);
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
        title="User Management"
        icon="bi-people"
        subtitle="Create and manage administrator, trainer and agent accounts."
        actions={<Button onClick={openCreate}><i className="bi bi-plus-lg me-1" /> New user</Button>}
      />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col lg={5}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search name, email or employee ID..." />
            </Col>
            <Col sm={6} lg={2}>
              <Form.Select value={list.filters.role} onChange={(e) => list.setFilter('role', e.target.value)} aria-label="Filter by role">
                <option value="">All roles</option>
                {ROLE_FILTERS.map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}
              </Form.Select>
            </Col>
            <Col sm={6} lg={2}>
              <Form.Select value={list.filters.isActive} onChange={(e) => list.setFilter('isActive', e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Form.Select>
            </Col>
            <Col sm={8} lg={2}>
              <Form.Select value={list.filters.batch} onChange={(e) => list.setFilter('batch', e.target.value)} aria-label="Filter by batch">
                <option value="">All batches</option>
                <option value="none">Unassigned</option>
                {batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name}</option>)}
              </Form.Select>
            </Col>
            <Col sm={4} lg={1} className="d-grid">
              <Button variant="light" onClick={() => { list.setSearch(''); list.setFilter('role', ''); list.setFilter('isActive', ''); list.setFilter('batch', ''); }} title="Clear filters" aria-label="Clear filters">
                <i className="bi bi-x-circle" />
              </Button>
            </Col>
          </Row>

          {list.loading ? <LoadingSpinner /> : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load users" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-people" title="No users found" message="Try a different search or filter, or create a new user." action={<Button onClick={openCreate}>New user</Button>} />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead><tr><th>User</th><th>Role</th><th>Batch</th><th>Status</th><th>Last login</th><th className="text-end">Actions</th></tr></thead>
                <tbody>{list.items.map((account) => {
                  const isSelf = String(account._id) === String(currentUser?._id);
                  return (
                    <tr key={account._id}>
                      <td><div className="fw-semibold">{fullName(account)}</div><div className="small text-muted">{account.email}</div><div className="small text-muted">{account.employeeId || 'No employee ID'}</div></td>
                      <td><StatusBadge status={account.role} /></td>
                      <td>{account.batch ? <><div>{account.batch.name}</div><div className="small text-muted">{account.batch.account}</div></> : <span className="text-muted">Unassigned</span>}</td>
                      <td><StatusBadge status={account.isActive ? 'active' : 'inactive'} />{isSelf && <div className="small text-muted mt-1">You</div>}</td>
                      <td className="small text-nowrap">{formatDate(account.lastLogin)}</td>
                      <td className="text-end text-nowrap">
                        <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(account)} aria-label={`Edit ${fullName(account)}`}><i className="bi bi-pencil" /></Button>
                        <Button size="sm" variant="light" className="me-1" onClick={() => requestStatusChange(account)} disabled={isSelf} aria-label={account.isActive ? `Deactivate ${fullName(account)}` : `Activate ${fullName(account)}`}><i className={`bi ${account.isActive ? 'bi-person-dash' : 'bi-person-check'}`} /></Button>
                        {account.isLoginLocked && !hiddenUnlockIds.has(account._id) && <Button size="sm" variant="light" className="me-1" onClick={() => unlock(account)} disabled={unlockingId === account._id} title="Clear login lock" aria-label={`Clear login lock for ${fullName(account)}`}><i className="bi bi-unlock" /></Button>}
                        <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(account)} disabled={isSelf} aria-label={`Delete ${fullName(account)}`}><i className="bi bi-trash" /></Button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </Table>
            </div>
          )}
          <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
        </Card.Body>
      </Card>

      <Modal show={showForm} onHide={() => !saving && !loadingUser && setShowForm(false)} size="lg" centered>
        <Form noValidate onSubmit={onSubmit}>
          <Modal.Header closeButton><Modal.Title className="h5">{editingId ? 'Edit user' : 'New user'}</Modal.Title></Modal.Header>
          <Modal.Body>
            {loadingUser ? <LoadingSpinner /> : <Row>
              <Col md={6} className="mb-3"><Form.Label htmlFor="firstName">First name</Form.Label><Form.Control id="firstName" name="firstName" value={form.firstName} onChange={onChange} isInvalid={!!errors.firstName} /><Form.Control.Feedback type="invalid">{errors.firstName}</Form.Control.Feedback></Col>
              <Col md={6} className="mb-3"><Form.Label htmlFor="lastName">Last name</Form.Label><Form.Control id="lastName" name="lastName" value={form.lastName} onChange={onChange} isInvalid={!!errors.lastName} /><Form.Control.Feedback type="invalid">{errors.lastName}</Form.Control.Feedback></Col>
              <Col md={7} className="mb-3"><Form.Label htmlFor="email">Email</Form.Label><Form.Control id="email" type="email" name="email" value={form.email} readOnly isInvalid={!!errors.email} /><Form.Text className="d-block text-muted">Generated from the user's first and last name.</Form.Text><Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback></Col>
              <Col md={5} className="mb-3"><Form.Label htmlFor="role">Role</Form.Label><Form.Select id="role" name="role" value={form.role} onChange={onChange} isInvalid={!!errors.role}>{(editingId && form.role === 'admin' ? ['admin', ...ROLE_OPTIONS] : ROLE_OPTIONS).map((role) => <option key={role} value={role}>{role[0].toUpperCase() + role.slice(1)}</option>)}</Form.Select><Form.Control.Feedback type="invalid">{errors.role}</Form.Control.Feedback></Col>
              <Col md={6} className="mb-3"><Form.Label htmlFor="password">Password {editingId && <span className="text-muted fw-normal">(leave blank to keep current)</span>}</Form.Label><Form.Control id="password" type="password" name="password" value={form.password} onChange={onChange} isInvalid={!!errors.password} autoComplete={editingId ? 'new-password' : 'new-password'} /><Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback></Col>
              {editingId && <Col md={6} className="mb-3"><Form.Label htmlFor="employeeId">Employee ID</Form.Label><Form.Control id="employeeId" name="employeeId" value={form.employeeId} readOnly /></Col>}
              <Col md={6} className="mb-3"><Form.Label htmlFor="phone">Phone</Form.Label><Form.Control id="phone" type="tel" inputMode="numeric" name="phone" value={form.phone} onChange={onChange} isInvalid={!!errors.phone} placeholder="09XXXXXXXXX" /><Form.Control.Feedback type="invalid">{errors.phone}</Form.Control.Feedback></Col>
              {form.role === 'agent' && <Col md={6} className="mb-3"><Form.Label htmlFor="batch">Training batch</Form.Label><Form.Select id="batch" name="batch" value={form.batch} onChange={onChange} isInvalid={!!errors.batch} disabled={batchesLoading}><option value="">Unassigned</option>{batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name}</option>)}</Form.Select><Form.Control.Feedback type="invalid">{errors.batch}</Form.Control.Feedback></Col>}
            </Row>}
          </Modal.Body>
          <Modal.Footer><Button variant="light" onClick={() => setShowForm(false)} disabled={saving || loadingUser}>Cancel</Button><Button type="submit" disabled={saving || loadingUser}>{saving && <Spinner size="sm" className="me-2" />}{editingId ? 'Save changes' : 'Create user'}</Button></Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal show={!!toDeactivate} title="Deactivate user?" message={<>Deactivate <strong>{fullName(toDeactivate)}</strong>? They will no longer be able to log in.</>} confirmText="Deactivate" onConfirm={() => changeStatus(toDeactivate)} onCancel={() => setToDeactivate(null)} loading={changingStatus} />
      <ConfirmModal show={!!toDelete} title="Delete user?" message={<>Delete <strong>{fullName(toDelete)}</strong>? Their learning records and certificates will also be deleted. This cannot be undone.</>} onConfirm={confirmDelete} onCancel={() => setToDelete(null)} loading={deleting} />
    </>
  );
}

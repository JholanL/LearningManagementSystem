/**
 * ============================================================
 *  REFERENCE PAGE  -  copy this pattern for every CRUD page
 * ============================================================
 *  Shows how to do:
 *   1. List + search + filter + pagination   (usePaginatedList hook)
 *   2. Create / Edit in one modal form        (with client + server validation)
 *   3. Delete with a confirmation dialog
 *   4. Toast notifications and error handling
 *   5. Loading dropdown data (trainers, courses) once
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { batchesApi, coursesApi, usersApi } from '../../api/services';
import { formatDate, fullName, getErrorMessage, getFieldErrors, toDateInput } from '../../utils/helpers';
import { required, validate } from '../../utils/validators';

const EMPTY_FORM = { name: '', account: '', description: '', trainer: '', courses: [], startDate: '', endDate: '', status: 'upcoming' };
const STATUSES = ['upcoming', 'ongoing', 'completed'];

export default function ManageBatches() {
  const toast = useToast();

  // 1. List state (search/filter/pagination handled by the hook)
  const list = usePaginatedList(batchesApi.list, { status: '' });

  // Dropdown data for the form
  const [trainers, setTrainers] = useState([]);
  const [courses, setCourses] = useState([]);
  useEffect(() => {
    usersApi.list({ role: 'trainer', isActive: 'true', limit: 100 }).then((res) => setTrainers(res.data)).catch(() => {});
    coursesApi.list({ limit: 100 }).then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  // 2. Create/Edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // 3. Delete state
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = async (batch) => {
    setEditingId(batch._id);
    setErrors({});
    setShowForm(true);
    // The list doesn't include the curriculum, so load the full batch
    try {
      const { data } = await batchesApi.get(batch._id);
      setForm({
        name: data.name,
        account: data.account,
        description: data.description || '',
        trainer: data.trainer?._id || '',
        courses: data.courses.map((c) => c._id),
        startDate: toDateInput(data.startDate),
        endDate: toDateInput(data.endDate),
        status: data.status,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setShowForm(false);
    }
  };

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const toggleCourse = (id) =>
    setForm((f) => ({ ...f, courses: f.courses.includes(id) ? f.courses.filter((c) => c !== id) : [...f.courses, id] }));

  const onSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation first (instant feedback)
    const found = validate(form, {
      name: [required('Batch name')],
      account: [required('Account')],
      trainer: [required('Trainer')],
      startDate: [required('Start date')],
      endDate: [required('End date'), [(v, all) => !all.startDate || v >= all.startDate, 'End date must be after the start date']],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      if (editingId) await batchesApi.update(editingId, form);
      else await batchesApi.create(form);
      toast.success(editingId ? 'Batch updated.' : 'Batch created.');
      setShowForm(false);
      list.reload();
    } catch (err) {
      // Show server validation messages under the matching inputs
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await batchesApi.remove(toDelete._id);
      toast.success(`${toDelete.name} deleted.`);
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
        title="Training Batches"
        icon="bi-collection"
        subtitle="Group new-hire agents into waves, assign a trainer and a curriculum."
        actions={
          <Button onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" /> New batch
          </Button>
        }
      />

      <Card>
        <Card.Body>
          {/* Toolbar: search + filter */}
          <Row className="g-2 mb-3">
            <Col md={8}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by batch name or account..." />
            </Col>
            <Col md={4}>
              <Form.Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {/* Table / loading / empty / error states */}
          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load batches" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-collection" title="No batches found" message="Try a different search or create a new batch." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>Trainer</th>
                    <th className="text-center">Agents</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <div className="fw-semibold">{b.name}</div>
                        <div className="small text-muted">{b.account}</div>
                      </td>
                      <td>{fullName(b.trainer)}</td>
                      <td className="text-center">
                        <Badge bg="light" text="dark" pill>
                          {b.agentCount}
                        </Badge>
                      </td>
                      <td className="small text-nowrap">
                        {formatDate(b.startDate)} - {formatDate(b.endDate)}
                      </td>
                      <td>
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="text-end text-nowrap">
                        <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(b)} aria-label={`Edit ${b.name}`}>
                          <i className="bi bi-pencil" />
                        </Button>
                        <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(b)} aria-label={`Delete ${b.name}`}>
                          <i className="bi bi-trash" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
        </Card.Body>
      </Card>

      {/* Create / Edit modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} size="lg" centered>
        <Form noValidate onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{editingId ? 'Edit batch' : 'New batch'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="name">Batch name</Form.Label>
                <Form.Control id="name" name="name" value={form.name} onChange={onChange} isInvalid={!!errors.name} placeholder="Wave 14" />
                <Form.Control.Feedback type="invalid">{errors.name}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="account">Account / LOB</Form.Label>
                <Form.Control id="account" name="account" value={form.account} onChange={onChange} isInvalid={!!errors.account} placeholder="Lumina Telecom - Postpaid Support" />
                <Form.Control.Feedback type="invalid">{errors.account}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="trainer">Trainer</Form.Label>
                <Form.Select id="trainer" name="trainer" value={form.trainer} onChange={onChange} isInvalid={!!errors.trainer}>
                  <option value="">Select a trainer</option>
                  {trainers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {fullName(t)}
                    </option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.trainer}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="status">Status</Form.Label>
                <Form.Select id="status" name="status" value={form.status} onChange={onChange}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="startDate">Start date</Form.Label>
                <Form.Control id="startDate" type="date" name="startDate" value={form.startDate} onChange={onChange} isInvalid={!!errors.startDate} />
                <Form.Control.Feedback type="invalid">{errors.startDate}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="endDate">End date</Form.Label>
                <Form.Control id="endDate" type="date" name="endDate" value={form.endDate} onChange={onChange} isInvalid={!!errors.endDate} />
                <Form.Control.Feedback type="invalid">{errors.endDate}</Form.Control.Feedback>
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="description">Description</Form.Label>
                <Form.Control id="description" as="textarea" rows={2} name="description" value={form.description} onChange={onChange} maxLength={500} />
              </Col>
              <Col xs={12}>
                <Form.Label>Curriculum (courses for this batch)</Form.Label>
                <div className="course-picker">
                  {courses.length === 0 && <div className="text-muted small p-2">No courses yet.</div>}
                  {courses.map((c) => (
                    <Form.Check
                      key={c._id}
                      id={`course-${c._id}`}
                      type="checkbox"
                      checked={form.courses.includes(c._id)}
                      onChange={() => toggleCourse(c._id)}
                      label={
                        <span>
                          <span className="fw-semibold">{c.code}</span> · {c.title} {!c.isPublished && <Badge bg="light" text="dark">Draft</Badge>}
                        </span>
                      }
                    />
                  ))}
                </div>
                <Form.Text>Agents only see published courses.</Form.Text>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner size="sm" className="me-2" />}
              {editingId ? 'Save changes' : 'Create batch'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title="Delete batch?"
        message={
          <>
            Delete <strong>{toDelete?.name}</strong>? Its agents will become unassigned. This cannot be undone.
          </>
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

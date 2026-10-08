/**
 * Course catalog management.
 * Shared by the trainer (/trainer/courses) and admin (/admin/courses) routes:
 *   - admin can edit/publish/delete every course
 *   - trainer can only touch the courses they created (the API enforces this too)
 * Pattern copied from admin/ManageBatches.jsx.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { coursesApi, metaApi } from '../../api/services';
import { fullName, getErrorMessage, getFieldErrors, ROLE_HOME } from '../../utils/helpers';
import { isUrl, required, validate } from '../../utils/validators';

const EMPTY_FORM = {
  code: '',
  title: '',
  description: '',
  category: '',
  level: 'Beginner',
  passingScore: 85,
  maxAttempts: 3,
  estimatedHours: 1,
  thumbnailUrl: '',
};

export default function TrainerCourses() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const base = ROLE_HOME[user.role]; // '/trainer' or '/admin' -> keeps "Build" links role-correct

  // 1. List state (search/filter/pagination handled by the hook)
  const list = usePaginatedList(coursesApi.list, { category: '', level: '', isPublished: '', mine: '' });

  // Dropdown data (categories + levels) loaded once
  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  useEffect(() => {
    metaApi
      .get()
      .then((res) => {
        setCategories(res.data.courseCategories);
        setLevels(res.data.courseLevels);
      })
      .catch(() => {});
  }, []);

  // 2. Create/Edit modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // 3. Delete + publish-toggle state
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  // Trainers may only edit courses they created; admins may edit all.
  const canEdit = useMemo(
    () => (course) => user.role === 'admin' || course.createdBy?._id === user._id,
    [user]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, category: categories[0] || '' });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (course) => {
    setEditingId(course._id);
    setErrors({});
    setForm({
      code: course.code,
      title: course.title,
      description: course.description || '',
      category: course.category,
      level: course.level,
      passingScore: course.passingScore,
      maxAttempts: course.maxAttempts,
      estimatedHours: course.estimatedHours,
      thumbnailUrl: course.thumbnailUrl || '',
    });
    setShowForm(true);
  };

  const onChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: undefined });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    // Client-side validation first (mirrors the backend rules for instant feedback)
    const found = validate(form, {
      code: [required('Course code'), [(v) => /^[A-Za-z0-9-]{2,20}$/.test(String(v).trim()), 'Code must be 2-20 letters, numbers or dashes']],
      title: [required('Title')],
      description: [required('Description')],
      category: [required('Category')],
      passingScore: [[(v) => v >= 1 && v <= 100, 'Passing score must be 1-100']],
      maxAttempts: [[(v) => v >= 1 && v <= 10, 'Max attempts must be 1-10']],
      estimatedHours: [[(v) => v >= 0 && v <= 200, 'Hours must be 0-200']],
      thumbnailUrl: [[isUrl, 'Enter a valid URL (http/https)']],
    });
    setErrors(found);
    if (Object.keys(found).length) return;

    // Numbers come out of inputs as strings - coerce before sending
    const payload = {
      ...form,
      code: form.code.trim().toUpperCase(),
      passingScore: Number(form.passingScore),
      maxAttempts: Number(form.maxAttempts),
      estimatedHours: Number(form.estimatedHours),
    };

    setSaving(true);
    try {
      if (editingId) {
        await coursesApi.update(editingId, payload);
        toast.success('Course updated.');
      } else {
        const res = await coursesApi.create(payload);
        toast.success('Course created. Add lessons next, then publish.');
        setShowForm(false);
        return navigate(`${base}/courses/${res.data._id}`); // jump straight to the builder
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

  const togglePublish = async (course) => {
    setPublishingId(course._id);
    try {
      const res = await coursesApi.togglePublish(course._id);
      toast.success(res.message);
      list.reload();
    } catch (err) {
      // e.g. "Add at least one lesson before publishing."
      toast.error(getErrorMessage(err));
    } finally {
      setPublishingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await coursesApi.remove(toDelete._id);
      toast.success(`${toDelete.code} deleted.`);
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
        title="Courses"
        icon="bi-journal-bookmark"
        subtitle="Build the training curriculum: lessons, videos and quizzes per course."
        actions={
          <Button onClick={openCreate}>
            <i className="bi bi-plus-lg me-1" /> New course
          </Button>
        }
      />

      <Card>
        <Card.Body>
          {/* Toolbar: search + filters */}
          <Row className="g-2 mb-3">
            <Col md={4}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by code, title or description..." />
            </Col>
            <Col sm={6} md={2}>
              <Form.Select value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)} aria-label="Filter by category">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6} md={2}>
              <Form.Select value={list.filters.level} onChange={(e) => list.setFilter('level', e.target.value)} aria-label="Filter by level">
                <option value="">All levels</option>
                {levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6} md={2}>
              <Form.Select value={list.filters.isPublished} onChange={(e) => list.setFilter('isPublished', e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                <option value="true">Published</option>
                <option value="false">Draft</option>
              </Form.Select>
            </Col>
            <Col sm={6} md={2} className="d-flex align-items-center">
              <Form.Check
                type="switch"
                id="mine-toggle"
                label="Only mine"
                checked={list.filters.mine === 'true'}
                onChange={(e) => list.setFilter('mine', e.target.checked ? 'true' : '')}
              />
            </Col>
          </Row>

          {/* Table / loading / empty / error states */}
          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load courses" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-journal-bookmark" title="No courses found" message="Try a different search or create a new course." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Level</th>
                    <th className="text-center">Content</th>
                    <th>Created by</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((c) => {
                    const editable = canEdit(c);
                    return (
                      <tr key={c._id}>
                        <td>
                          <div className="fw-semibold">
                            <span className="text-primary">{c.code}</span> · {c.title}
                          </div>
                          <div className="small text-muted">
                            <Badge bg="light" text="dark" className="me-1">{c.category}</Badge>
                            {c.estimatedHours}h · pass {c.passingScore}%
                          </div>
                        </td>
                        <td>{c.level}</td>
                        <td className="text-center small text-nowrap">
                          <span className="me-2"><i className="bi bi-file-earmark-text me-1" />{c.lessonCount}</span>
                          <span><i className="bi bi-patch-question me-1" />{c.quizCount}</span>
                        </td>
                        <td className="small">{fullName(c.createdBy)}</td>
                        <td>
                          <Badge bg={c.isPublished ? 'success' : 'secondary'}>{c.isPublished ? 'Published' : 'Draft'}</Badge>
                        </td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="light" className="me-1" onClick={() => navigate(`${base}/courses/${c._id}`)} aria-label={`Build ${c.code}`} title="Lessons & quizzes">
                            <i className="bi bi-tools" />
                          </Button>
                          {editable && (
                            <>
                              <Button size="sm" variant="light" className="me-1" onClick={() => togglePublish(c)} disabled={publishingId === c._id} aria-label={`${c.isPublished ? 'Unpublish' : 'Publish'} ${c.code}`} title={c.isPublished ? 'Unpublish' : 'Publish'}>
                                {publishingId === c._id ? <Spinner size="sm" /> : <i className={`bi ${c.isPublished ? 'bi-eye-slash' : 'bi-send'}`} />}
                              </Button>
                              <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(c)} aria-label={`Edit ${c.code}`} title="Edit details">
                                <i className="bi bi-pencil" />
                              </Button>
                              <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(c)} aria-label={`Delete ${c.code}`} title="Delete">
                                <i className="bi bi-trash" />
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
            <Modal.Title className="h5">{editingId ? 'Edit course' : 'New course'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={4} className="mb-3">
                <Form.Label htmlFor="code">Course code</Form.Label>
                <Form.Control id="code" name="code" value={form.code} onChange={onChange} isInvalid={!!errors.code} placeholder="CSF-101" />
                <Form.Control.Feedback type="invalid">{errors.code}</Form.Control.Feedback>
              </Col>
              <Col md={8} className="mb-3">
                <Form.Label htmlFor="title">Title</Form.Label>
                <Form.Control id="title" name="title" value={form.title} onChange={onChange} isInvalid={!!errors.title} maxLength={120} placeholder="Call Handling Fundamentals" />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="category">Category</Form.Label>
                <Form.Select id="category" name="category" value={form.category} onChange={onChange} isInvalid={!!errors.category}>
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Form.Select>
                <Form.Control.Feedback type="invalid">{errors.category}</Form.Control.Feedback>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="level">Level</Form.Label>
                <Form.Select id="level" name="level" value={form.level} onChange={onChange}>
                  {levels.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label htmlFor="passingScore">Passing score (%)</Form.Label>
                <Form.Control id="passingScore" type="number" name="passingScore" min={1} max={100} value={form.passingScore} onChange={onChange} isInvalid={!!errors.passingScore} />
                <Form.Control.Feedback type="invalid">{errors.passingScore}</Form.Control.Feedback>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label htmlFor="maxAttempts">Max quiz attempts</Form.Label>
                <Form.Control id="maxAttempts" type="number" name="maxAttempts" min={1} max={10} value={form.maxAttempts} onChange={onChange} isInvalid={!!errors.maxAttempts} />
                <Form.Control.Feedback type="invalid">{errors.maxAttempts}</Form.Control.Feedback>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label htmlFor="estimatedHours">Estimated hours</Form.Label>
                <Form.Control id="estimatedHours" type="number" name="estimatedHours" min={0} max={200} step={0.5} value={form.estimatedHours} onChange={onChange} isInvalid={!!errors.estimatedHours} />
                <Form.Control.Feedback type="invalid">{errors.estimatedHours}</Form.Control.Feedback>
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="description">Description</Form.Label>
                <Form.Control id="description" as="textarea" rows={3} name="description" value={form.description} onChange={onChange} isInvalid={!!errors.description} maxLength={2000} placeholder="What agents will learn in this course..." />
                <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
              </Col>
              <Col xs={12} className="mb-1">
                <Form.Label htmlFor="thumbnailUrl">Thumbnail URL <span className="text-muted">(optional)</span></Form.Label>
                <Form.Control id="thumbnailUrl" name="thumbnailUrl" value={form.thumbnailUrl} onChange={onChange} isInvalid={!!errors.thumbnailUrl} placeholder="https://..." />
                <Form.Control.Feedback type="invalid">{errors.thumbnailUrl}</Form.Control.Feedback>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner size="sm" className="me-2" />}
              {editingId ? 'Save changes' : 'Create course'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title="Delete course?"
        message={
          <>
            Delete <strong>{toDelete?.code} · {toDelete?.title}</strong>? Its lessons, quizzes, attempts and certificates will be removed. This cannot be undone.
          </>
        }
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

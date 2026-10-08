/**
 * Admin / Trainer → Knowledge Base management.
 * Shared by both roles: admin edits every article & can delete; a trainer edits
 * only the articles they authored (the API enforces this too).
 * List + filters + modal editor (tags chips, body preview, related courses).
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Col, Form, Modal, Nav, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import ArticleBody from '../../components/ArticleBody';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { kbApi, coursesApi } from '../../api/services';
import { fullName, getErrorMessage, getFieldErrors } from '../../utils/helpers';
import { required, validate } from '../../utils/validators';

const CATEGORIES = ['Product', 'Billing', 'Technical', 'Process', 'Compliance', 'Scripts'];
const EMPTY = { title: '', category: 'Product', tags: [], summary: '', body: '', account: 'Lumina Telecom', relatedCourses: [], status: 'draft' };

export default function ManageKnowledgeBase() {
  const toast = useToast();
  const { user } = useAuth();
  const list = usePaginatedList(kbApi.list, { category: '', status: '', tag: '' });

  const [courses, setCourses] = useState([]);
  useEffect(() => {
    coursesApi.list({ limit: 100 }).then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('write');
  const [tagInput, setTagInput] = useState('');

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  const canEdit = (a) => user.role === 'admin' || a.author?._id === user._id;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setErrors({});
    setTab('write');
    setShowForm(true);
  };

  const openEdit = async (a) => {
    setEditingId(a._id);
    setErrors({});
    setTab('write');
    setShowForm(true);
    try {
      const { data } = await kbApi.get(a.slug);
      setForm({
        title: data.title,
        category: data.category,
        tags: data.tags || [],
        summary: data.summary || '',
        body: data.body || '',
        account: data.account || '',
        relatedCourses: (data.relatedCourses || []).map((c) => c._id),
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

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t) && form.tags.length < 10) setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput('');
  };
  const removeTag = (t) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }));
  const toggleCourse = (id) =>
    setForm((f) => ({ ...f, relatedCourses: f.relatedCourses.includes(id) ? f.relatedCourses.filter((c) => c !== id) : [...f.relatedCourses, id] }));

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form, {
      title: [required('Title')],
      category: [required('Category')],
      body: [required('Body')],
    });
    setErrors(found);
    if (Object.keys(found).length) {
      setTab('write');
      return;
    }
    setSaving(true);
    try {
      if (editingId) await kbApi.update(editingId, form);
      else await kbApi.create(form);
      toast.success(editingId ? 'Article updated.' : 'Article created.');
      setShowForm(false);
      list.reload();
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (a) => {
    setPublishingId(a._id);
    try {
      const res = await kbApi.togglePublish(a._id);
      toast.success(res.message);
      list.reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPublishingId(null);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await kbApi.remove(toDelete._id);
      toast.success('Article deleted.');
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
        title="Knowledge Base"
        icon="bi-journal-richtext"
        subtitle="Product info, scripts and troubleshooting guides agents can search during calls."
        actions={<Button onClick={openCreate}><i className="bi bi-plus-lg me-1" /> New article</Button>}
      />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={6}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search title, summary, tags or body..." />
            </Col>
            <Col sm={6} md={3}>
              <Form.Select value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)} aria-label="Filter by category">
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Form.Select>
            </Col>
            <Col sm={6} md={3}>
              <Form.Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </Form.Select>
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load articles" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-journal-richtext" title="No articles found" message="Try a different search or create a new article." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Category</th>
                    <th className="text-center">Views</th>
                    <th>Author</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((a) => {
                    const editable = canEdit(a);
                    return (
                      <tr key={a._id}>
                        <td>
                          <div className="fw-semibold">{a.title}</div>
                          <div className="small text-muted text-truncate" style={{ maxWidth: 360 }}>{a.summary}</div>
                        </td>
                        <td><span className="badge-tone badge-gray">{a.category}</span></td>
                        <td className="text-center small">{a.views}</td>
                        <td className="small">{fullName(a.author)}</td>
                        <td><span className={`badge-tone ${a.status === 'published' ? 'badge-green' : 'badge-gray'}`}>{a.status}</span></td>
                        <td className="text-end text-nowrap">
                          {editable && (
                            <Button size="sm" variant="light" className="me-1" onClick={() => togglePublish(a)} disabled={publishingId === a._id} title={a.status === 'published' ? 'Unpublish' : 'Publish'}>
                              {publishingId === a._id ? <Spinner size="sm" /> : <i className={`bi ${a.status === 'published' ? 'bi-eye-slash' : 'bi-send'}`} />}
                            </Button>
                          )}
                          {editable && (
                            <Button size="sm" variant="light" className="me-1" onClick={() => openEdit(a)} title="Edit"><i className="bi bi-pencil" /></Button>
                          )}
                          {user.role === 'admin' && (
                            <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(a)} title="Delete"><i className="bi bi-trash" /></Button>
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

      {/* Editor modal */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)} size="lg" centered>
        <Form noValidate onSubmit={onSubmit}>
          <Modal.Header closeButton>
            <Modal.Title className="h5">{editingId ? 'Edit article' : 'New article'}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={8} className="mb-3">
                <Form.Label htmlFor="title">Title</Form.Label>
                <Form.Control id="title" name="title" value={form.title} onChange={onChange} isInvalid={!!errors.title} maxLength={150} />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
              </Col>
              <Col md={4} className="mb-3">
                <Form.Label htmlFor="category">Category</Form.Label>
                <Form.Select id="category" name="category" value={form.category} onChange={onChange}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label htmlFor="account">Account</Form.Label>
                <Form.Control id="account" name="account" value={form.account} onChange={onChange} maxLength={100} />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Tags <span className="text-muted">(max 10)</span></Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Type a tag, press Enter"
                  />
                  <Button variant="light" onClick={addTag} type="button">Add</Button>
                </div>
                <div className="mt-2 d-flex flex-wrap gap-1">
                  {form.tags.map((t) => (
                    <Badge key={t} bg="light" text="dark" className="tag-chip" role="button" onClick={() => removeTag(t)}>
                      {t} <i className="bi bi-x" />
                    </Badge>
                  ))}
                </div>
              </Col>
              <Col xs={12} className="mb-3">
                <Form.Label htmlFor="summary">Summary <span className="text-muted">(shown in results)</span></Form.Label>
                <Form.Control id="summary" as="textarea" rows={2} name="summary" value={form.summary} onChange={onChange} maxLength={300} />
              </Col>
              <Col xs={12} className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="mb-0">Body</Form.Label>
                  <Nav variant="pills" activeKey={tab} onSelect={(k) => setTab(k)} className="kb-tabs">
                    <Nav.Item><Nav.Link eventKey="write" className="py-0 px-2 small">Write</Nav.Link></Nav.Item>
                    <Nav.Item><Nav.Link eventKey="preview" className="py-0 px-2 small">Preview</Nav.Link></Nav.Item>
                  </Nav>
                </div>
                {tab === 'write' ? (
                  <>
                    <Form.Control as="textarea" rows={10} name="body" value={form.body} onChange={onChange} isInvalid={!!errors.body} maxLength={20000} placeholder="Plain text. Line breaks are preserved." />
                    <Form.Control.Feedback type="invalid">{errors.body}</Form.Control.Feedback>
                  </>
                ) : (
                  <div className="border rounded p-3 bg-white kb-preview">
                    {form.body ? <ArticleBody text={form.body} /> : <span className="text-muted">Nothing to preview yet.</span>}
                  </div>
                )}
              </Col>
              <Col xs={12}>
                <Form.Label>Related courses</Form.Label>
                <div className="course-picker">
                  {courses.length === 0 && <div className="text-muted small p-2">No courses yet.</div>}
                  {courses.map((c) => (
                    <Form.Check
                      key={c._id}
                      id={`kb-course-${c._id}`}
                      type="checkbox"
                      checked={form.relatedCourses.includes(c._id)}
                      onChange={() => toggleCourse(c._id)}
                      label={<span><span className="fw-semibold">{c.code}</span> · {c.title}</span>}
                    />
                  ))}
                </div>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="light" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner size="sm" className="me-2" />}
              {editingId ? 'Save changes' : 'Create article'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ConfirmModal
        show={!!toDelete}
        title="Delete article?"
        message={<>Delete <strong>{toDelete?.title}</strong>? This cannot be undone.</>}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

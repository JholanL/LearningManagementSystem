/**
 * Trainer → Call Simulator scenarios (list).
 * Search + category/difficulty/status filters, publish toggle, delete, → Scenario Builder.
 * Trainer edits only their own scenarios; admin edits all (the API enforces this).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { scenariosApi, metaApi } from '../../api/services';
import { fullName, getErrorMessage } from '../../utils/helpers';

const DIFF_TONE = { Easy: 'badge-green', Medium: 'badge-amber', Hard: 'badge-red' };

export default function TrainerScenarios() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const list = usePaginatedList(scenariosApi.list, { category: '', difficulty: '', isPublished: '' });

  const [categories, setCategories] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  useEffect(() => {
    metaApi.get().then((res) => { setCategories(res.data.scenarioCategories); setDifficulties(res.data.scenarioDifficulties); }).catch(() => {});
  }, []);

  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  const canEdit = (s) => user.role === 'admin' || s.createdBy?._id === user._id;

  const togglePublish = async (s) => {
    setPublishingId(s._id);
    try { const res = await scenariosApi.togglePublish(s._id); toast.success(res.message); list.reload(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setPublishingId(null); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try { await scenariosApi.remove(toDelete._id); toast.success('Scenario deleted.'); setToDelete(null); list.reload(); }
    catch (err) { toast.error(getErrorMessage(err)); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <PageHeader
        title="Call Simulator"
        icon="bi-headset"
        subtitle="Build branching call scenarios for agents to practice."
        actions={<Button onClick={() => navigate('/trainer/scenarios/new')}><i className="bi bi-plus-lg me-1" />New scenario</Button>}
      />

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={6}><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search scenarios..." /></Col>
            <Col sm={4} md={2}>
              <Form.Select value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)} aria-label="Category">
                <option value="">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Form.Select>
            </Col>
            <Col sm={4} md={2}>
              <Form.Select value={list.filters.difficulty} onChange={(e) => list.setFilter('difficulty', e.target.value)} aria-label="Difficulty">
                <option value="">All levels</option>{difficulties.map((d) => <option key={d} value={d}>{d}</option>)}
              </Form.Select>
            </Col>
            <Col sm={4} md={2}>
              <Form.Select value={list.filters.isPublished} onChange={(e) => list.setFilter('isPublished', e.target.value)} aria-label="Status">
                <option value="">All statuses</option><option value="true">Published</option><option value="false">Draft</option>
              </Form.Select>
            </Col>
          </Row>

          {list.loading ? (
            <LoadingSpinner />
          ) : list.error ? (
            <EmptyState icon="bi-exclamation-triangle" title="Could not load scenarios" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
          ) : list.items.length === 0 ? (
            <EmptyState icon="bi-headset" title="No scenarios yet" message="Create your first call scenario." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr><th>Scenario</th><th>Customer</th><th>Difficulty</th><th>Status</th><th>By</th><th className="text-end">Actions</th></tr>
                </thead>
                <tbody>
                  {list.items.map((s) => {
                    const editable = canEdit(s);
                    return (
                      <tr key={s._id}>
                        <td>
                          <div className="fw-semibold">{s.title}</div>
                          <div className="small text-muted"><span className="badge-tone badge-gray">{s.category}</span></div>
                        </td>
                        <td className="small">{s.customer?.name} <span className="text-muted">({s.customer?.mood})</span></td>
                        <td><span className={`badge-tone ${DIFF_TONE[s.difficulty] || 'badge-gray'}`}>{s.difficulty}</span></td>
                        <td><span className={`badge-tone ${s.isPublished ? 'badge-green' : 'badge-gray'}`}>{s.isPublished ? 'Published' : 'Draft'}</span></td>
                        <td className="small">{fullName(s.createdBy)}</td>
                        <td className="text-end text-nowrap">
                          {editable && (
                            <>
                              <Button size="sm" variant="light" className="me-1" onClick={() => togglePublish(s)} disabled={publishingId === s._id} title={s.isPublished ? 'Unpublish' : 'Publish'}>
                                {publishingId === s._id ? <Spinner size="sm" /> : <i className={`bi ${s.isPublished ? 'bi-eye-slash' : 'bi-send'}`} />}
                              </Button>
                              <Button size="sm" variant="light" className="me-1" onClick={() => navigate(`/trainer/scenarios/${s._id}`)} title="Edit"><i className="bi bi-pencil" /></Button>
                              <Button size="sm" variant="light" className="text-danger" onClick={() => setToDelete(s)} title="Delete"><i className="bi bi-trash" /></Button>
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

      <ConfirmModal
        show={!!toDelete}
        title="Delete scenario?"
        message={<>Delete <strong>{toDelete?.title}</strong>? Its attempts will be removed too. This cannot be undone.</>}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}

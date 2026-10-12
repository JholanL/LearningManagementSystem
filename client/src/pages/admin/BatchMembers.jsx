import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import ConfirmModal from '../../components/ConfirmModal';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import { useToast } from '../../context/ToastContext';
import { batchesApi, usersApi } from '../../api/services';
import { formatDate, fullName, getErrorMessage } from '../../utils/helpers';

const memberId = (member) => String(member?._id || member);
const normalizeSearch = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

async function fetchAllAgents() {
  const first = await usersApi.list({ role: 'agent', page: 1, limit: 100 });
  const pages = Array.from({ length: Math.max((first.pagination?.totalPages || 1) - 1, 0) }, (_, index) => index + 2);
  const rest = await Promise.all(pages.map((page) => usersApi.list({ role: 'agent', page, limit: 100 })));
  return [first, ...rest].flatMap((response) => response.data || []);
}

function matchesSearch(agent, search) {
  const query = normalizeSearch(search);
  if (!query) return true;
  return [fullName(agent), agent.email, agent.employeeId].some((value) => normalizeSearch(value).includes(query));
}

export default function BatchMembers() {
  const { id } = useParams();
  const toast = useToast();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAssign, setShowAssign] = useState(false);
  const [allAgents, setAllAgents] = useState([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [toRemove, setToRemove] = useState(null);
  const [removing, setRemoving] = useState(false);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await batchesApi.get(id);
      setBatch(response.data);
    } catch (err) {
      setBatch(null);
      setError(getErrorMessage(err, 'The selected batch could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBatch();
  }, [loadBatch]);

  const filteredMembers = useMemo(
    () => (batch?.agents || []).filter((agent) => matchesSearch(agent, search)),
    [batch, search]
  );

  const assignedIds = useMemo(() => new Set((batch?.agents || []).map(memberId)), [batch]);
  const availableAgents = useMemo(
    () => allAgents.filter((agent) => agent.isActive && !assignedIds.has(memberId(agent)) && !agent.batch && matchesSearch(agent, assignSearch)),
    [allAgents, assignedIds, assignSearch]
  );
  const conflictingAgents = useMemo(
    () => allAgents.filter((agent) => agent.isActive && !assignedIds.has(memberId(agent)) && agent.batch && matchesSearch(agent, assignSearch)),
    [allAgents, assignedIds, assignSearch]
  );

  const openAssign = async () => {
    setShowAssign(true);
    setAssignSearch('');
    setSelectedAgents([]);
    setLoadingAgents(true);
    try {
      setAllAgents(await fetchAllAgents());
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load eligible agents.'));
      setAllAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const toggleAgent = (agentId) => {
    setSelectedAgents((current) => (
      current.includes(agentId) ? current.filter((idValue) => idValue !== agentId) : [...current, agentId]
    ));
  };

  const assignAgents = async () => {
    if (!selectedAgents.length || !batch) return;
    setSavingMembers(true);
    try {
      const [latestBatchResponse, latestAgents] = await Promise.all([batchesApi.get(id), fetchAllAgents()]);
      const latestBatch = latestBatchResponse.data;
      const latestAgentMap = new Map(latestAgents.map((agent) => [memberId(agent), agent]));
      const conflicts = selectedAgents
        .map((agentId) => latestAgentMap.get(agentId))
        .filter((agent) => agent?.batch && memberId(agent.batch) !== id);
      if (conflicts.length) {
        throw new Error(`${conflicts.map(fullName).join(', ')} ${conflicts.length === 1 ? 'is' : 'are'} already assigned to another batch.`);
      }

      const latestIds = (latestBatch.agents || []).map(memberId);
      const nextIds = [...new Set([...latestIds, ...selectedAgents])];
      await batchesApi.setAgents(id, nextIds, latestBatch.membershipVersion);
      toast.success('Batch members updated.');
      setShowAssign(false);
      await loadBatch();
    } catch (err) {
      if (err.response?.status === 409) {
        await loadBatch();
        toast.error('Batch membership changed. The latest membership was loaded; review it and try again.');
      } else {
        toast.error(err.response ? getErrorMessage(err, 'Could not assign agents.') : err.message || 'Could not assign agents.');
      }
    } finally {
      setSavingMembers(false);
    }
  };

  const confirmRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      const latestBatch = (await batchesApi.get(id)).data;
      const nextIds = (latestBatch.agents || []).filter((agent) => memberId(agent) !== memberId(toRemove)).map(memberId);
      await batchesApi.setAgents(id, nextIds, latestBatch.membershipVersion);
      toast.success(`${fullName(toRemove)} was removed from ${latestBatch.name}.`);
      setToRemove(null);
      await loadBatch();
    } catch (err) {
      if (err.response?.status === 409) {
        await loadBatch();
        toast.error('Batch membership changed. The latest membership was loaded; review it and try again.');
      } else {
        toast.error(getErrorMessage(err, 'Could not remove the agent from this batch.'));
      }
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  if (error || !batch) {
    return (
      <>
        <PageHeader title="Batch Members" icon="bi-person-lines-fill" subtitle="Manage agents assigned to a training batch." />
        <EmptyState
          icon="bi-exclamation-triangle"
          title="Could not load batch"
          message={error || 'Batch not found.'}
          action={<Button onClick={loadBatch}>Retry</Button>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Batch Members"
        icon="bi-person-lines-fill"
        subtitle={`Manage agents assigned to ${batch.name}.`}
        actions={<Button as={Link} to="/admin/batches" variant="light"><i className="bi bi-arrow-left me-1" /> Back to batches</Button>}
      />

      <Row className="g-3 mb-4">
        <Col xs={12} lg={8}>
          <Card className="h-100">
            <Card.Body>
              <div className="d-flex flex-wrap justify-content-between gap-3">
                <div>
                  <div className="small text-muted">Batch / wave</div>
                  <h2 className="h5 fw-bold mb-1">{batch.name}</h2>
                  <div className="text-muted">{batch.account}</div>
                </div>
                <StatusBadge status={batch.status} />
              </div>
              <Row className="g-3 mt-2 small">
                <Col sm={4}><div className="text-muted">Trainer</div><div className="fw-semibold">{fullName(batch.trainer)}</div></Col>
                <Col sm={4}><div className="text-muted">Assigned agents</div><div className="fw-semibold">{batch.agents.length}</div></Col>
                <Col sm={4}><div className="text-muted">Schedule</div><div className="fw-semibold">{formatDate(batch.startDate)} – {formatDate(batch.endDate)}</div></Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={12} lg={4}>
          <Card className="h-100">
            <Card.Body>
              <div className="small text-muted mb-1">Membership changes</div>
              <p className="small mb-3">Assignment replaces the batch membership list. Existing training records are not deleted.</p>
              <Button onClick={openAssign}><i className="bi bi-person-plus me-1" /> Assign agents</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Row className="g-2 mb-3">
            <Col md={8} lg={6}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search assigned agents..." />
            </Col>
          </Row>

          {batch.agents.length === 0 ? (
            <EmptyState icon="bi-people" title="No agents are currently assigned to this batch." message="Use Assign agents to add eligible active agent accounts." />
          ) : filteredMembers.length === 0 ? (
            <EmptyState icon="bi-people" title="No matching agents" message="Try a different name, email, or employee ID." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Employee ID</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((agent) => (
                    <tr key={agent._id}>
                      <td className="fw-semibold">{fullName(agent)}</td>
                      <td>{agent.employeeId || '—'}</td>
                      <td>{agent.email || '—'}</td>
                      <td><StatusBadge status={agent.isActive ? 'active' : 'inactive'} /></td>
                      <td className="text-end">
                        <Button size="sm" variant="light" className="text-danger" onClick={() => setToRemove(agent)}>
                          <i className="bi bi-person-dash me-1" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showAssign} onHide={() => !savingMembers && setShowAssign(false)} size="lg" centered>
        <Modal.Header closeButton>
          <div>
            <Modal.Title className="h5">Assign agents to {batch.name}</Modal.Title>
            <p className="modal-subtitle mb-0">Only active, unassigned agent accounts can be selected.</p>
          </div>
        </Modal.Header>
        <Modal.Body>
          <SearchBar value={assignSearch} onChange={setAssignSearch} placeholder="Search eligible agents..." />
          <Alert variant="light" className="small mt-3 mb-3">
            Agents assigned to another batch are shown as unavailable. Transfers are not supported by the current API.
          </Alert>
          {loadingAgents ? (
            <LoadingSpinner text="Loading eligible agents..." />
          ) : availableAgents.length === 0 ? (
            <EmptyState icon="bi-person-plus" title="No eligible agents found" message={assignSearch ? 'Try a different search.' : 'All active agents are already assigned or unavailable.'} />
          ) : (
            <div className="border rounded p-2" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {availableAgents.map((agent) => (
                <Form.Check
                  key={agent._id}
                  id={`assign-agent-${agent._id}`}
                  type="checkbox"
                  checked={selectedAgents.includes(agent._id)}
                  onChange={() => toggleAgent(agent._id)}
                  label={<span><span className="fw-semibold">{fullName(agent)}</span> <span className="text-muted">· {agent.employeeId || agent.email}</span></span>}
                />
              ))}
            </div>
          )}
          {conflictingAgents.length > 0 && (
            <div className="small text-muted mt-3">
              Unavailable in another batch: {conflictingAgents.map(fullName).join(', ')}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="light" onClick={() => setShowAssign(false)} disabled={savingMembers}>Cancel</Button>
          <Button onClick={assignAgents} disabled={!selectedAgents.length || savingMembers}>
            {savingMembers && <Spinner size="sm" className="me-2" />}
            Assign selected ({selectedAgents.length})
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={!!toRemove}
        title="Remove agent from batch?"
        message={<>Are you sure you want to remove <strong>{toRemove && fullName(toRemove)}</strong> from <strong>{batch.name}</strong>? This changes only the batch membership; the user account and training records are not deleted.</>}
        confirmText="Remove agent"
        loading={removing}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </>
  );
}

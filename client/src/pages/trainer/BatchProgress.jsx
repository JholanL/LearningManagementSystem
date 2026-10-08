/**
 * Batch Progress (/trainer/batches/:id, admin too): class-record matrix of
 * agents (rows) × courses (columns), overall % + Production Ready, and a
 * "Trends" button per agent that opens the analytics trend modal (feature 3).
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, ProgressBar, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import AgentTrendModal from '../../components/AgentTrendModal';
import EndorsementModal from '../../components/EndorsementModal';
import ProductionBadge from '../../components/ProductionBadge';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { progressApi } from '../../api/services';
import { fullName } from '../../utils/helpers';

const variantFor = (status) => (status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : undefined);

export default function BatchProgress() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => progressApi.batch(id), [id]);
  const [search, setSearch] = useState('');
  const [trendAgent, setTrendAgent] = useState(null);
  const [endorseAgent, setEndorseAgent] = useState(null);

  const batch = data?.data?.batch;
  const courses = data?.data?.courses || [];
  const rows = data?.data?.rows || [];
  const q = search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => fullName(r.agent).toLowerCase().includes(q)) : rows;

  if (loading) return <LoadingSpinner />;
  if (error) return <EmptyState icon="bi-exclamation-triangle" title="Could not load progress" message={error} action={<Button onClick={reload}>Retry</Button>} />;

  return (
    <>
      <PageHeader title={batch ? `${batch.name} · Progress` : 'Batch Progress'} icon="bi-table" subtitle={batch?.account} />

      <Card>
        <Card.Body>
          <div className="mb-3" style={{ maxWidth: 360 }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Filter agents by name..." />
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon="bi-people" title="No agents" message="No agents match your filter, or this batch has none yet." />
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Agent</th>
                    {courses.map((c) => <th key={c._id} className="text-center small">{c.code}</th>)}
                    <th className="text-center">Overall</th>
                    <th className="text-end">Trends</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.agent._id}>
                      <td>
                        <div className="fw-semibold">{fullName(r.agent)}</div>
                        <div className="small text-muted d-flex flex-wrap align-items-center gap-2">
                          {r.agent.employeeId}
                          <ProductionBadge status={r.agent.productionStatus} />
                          {r.productionReady && r.agent.productionStatus === 'in_training' && <span className="badge-tone badge-blue">Ready to endorse</span>}
                        </div>
                      </td>
                      {courses.map((c) => {
                        const cell = r.courses.find((x) => String(x.courseId) === String(c._id));
                        const pct = cell?.percent ?? 0;
                        return (
                          <td key={c._id} style={{ minWidth: 110 }}>
                            <ProgressBar now={pct} variant={variantFor(cell?.status)} style={{ height: 8 }} />
                            <div className="text-center small text-muted mt-1">{pct}%</div>
                          </td>
                        );
                      })}
                      <td className="text-center fw-semibold">{r.overallPercent}%</td>
                      <td className="text-end text-nowrap">
                        {user.role === 'trainer' && r.agent.productionStatus === 'in_training' && (
                          <Button size="sm" variant="light" className="me-1" onClick={() => setEndorseAgent({ id: r.agent._id, name: fullName(r.agent) })} title="Endorse for production">
                            <i className="bi bi-hand-thumbs-up" />
                          </Button>
                        )}
                        <Button size="sm" variant="light" onClick={() => setTrendAgent({ id: r.agent._id, name: fullName(r.agent) })} title="Performance trends">
                          <i className="bi bi-graph-up-arrow" />
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

      <AgentTrendModal
        show={!!trendAgent}
        agentId={trendAgent?.id}
        agentName={trendAgent?.name}
        onHide={() => setTrendAgent(null)}
      />

      <EndorsementModal
        show={!!endorseAgent}
        agent={endorseAgent}
        onHide={() => setEndorseAgent(null)}
        onDone={reload}
      />
    </>
  );
}

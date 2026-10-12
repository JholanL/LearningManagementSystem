import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import { batchesApi, leaderboardApi } from '../../api/services';
import { fullName, getErrorMessage } from '../../utils/helpers';

const agentId = (agent) => String(agent?._id || agent);
const normalizeSearch = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const scoreLabel = (value) => (typeof value === 'number' ? `${value}%` : '—');
const weightLabel = (value) => (typeof value === 'number' ? `${Math.round(value * 100)}%` : '—');
const EMPTY_ROWS = [];

async function fetchAllBatches() {
  const first = await batchesApi.list({ page: 1, limit: 100 });
  const pages = Array.from({ length: Math.max((first.pagination?.totalPages || 1) - 1, 0) }, (_, index) => index + 2);
  const rest = await Promise.all(pages.map((page) => batchesApi.list({ page, limit: 100 })));
  return [first, ...rest].flatMap((response) => response.data || []);
}

function matchesSearch(row, search) {
  const query = normalizeSearch(search);
  if (!query) return true;
  return [fullName(row.agent), row.agent?.employeeId].some((value) => normalizeSearch(value).includes(query));
}

export default function AdminLeaderboard() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [batchesError, setBatchesError] = useState('');
  const [ranking, setRanking] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState('');
  const [leaderboardReloadKey, setLeaderboardReloadKey] = useState(0);
  const [search, setSearch] = useState('');

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError('');
    try {
      const data = await fetchAllBatches();
      setBatches(data);
      setSelectedBatch((current) => (data.some((batch) => batch._id === current) ? current : data[0]?._id || ''));
    } catch (err) {
      setBatches([]);
      setSelectedBatch('');
      setBatchesError(getErrorMessage(err, 'Could not load training batches.'));
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!selectedBatch) {
      setRanking(null);
      setLeaderboardError('');
      return undefined;
    }

    let ignore = false;
    setRanking(null);
    setLeaderboardLoading(true);
    setLeaderboardError('');
    setSearch('');

    leaderboardApi
      .get(selectedBatch)
      .then((response) => {
        if (!ignore) setRanking(response.data);
      })
      .catch((err) => {
        if (!ignore) setLeaderboardError(getErrorMessage(err, 'Could not load leaderboard rankings.'));
      })
      .finally(() => {
        if (!ignore) setLeaderboardLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [selectedBatch, leaderboardReloadKey]);

  const rows = ranking?.rows || EMPTY_ROWS;
  const filteredRows = useMemo(() => rows.filter((row) => matchesSearch(row, search)), [rows, search]);
  const hasScores = rows.some((row) => [row.averageQuizScore, row.averageSimulatorScore, row.averageEvaluationScore].some((score) => score !== null));

  return (
    <>
      <PageHeader
        title="Agent Leaderboard"
        icon="bi-trophy"
        subtitle="Monitor and compare agent training performance across batches."
      />

      <Card className="mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={6} lg={5}>
              <Form.Label htmlFor="leaderboard-batch" className="small fw-semibold">Training batch / wave</Form.Label>
              {batchesLoading ? (
                <LoadingSpinner text="Loading batches..." />
              ) : batchesError ? (
                <EmptyState icon="bi-exclamation-triangle" title="Could not load batches" message={batchesError} action={<Button onClick={loadBatches}>Retry</Button>} />
              ) : batches.length === 0 ? (
                <EmptyState icon="bi-collection" title="No batches available" message="Create a training batch before viewing rankings." />
              ) : (
                <Form.Select id="leaderboard-batch" value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)} aria-label="Select training batch">
                  {batches.map((batch) => <option key={batch._id} value={batch._id}>{batch.name} · {batch.account}</option>)}
                </Form.Select>
              )}
            </Col>
            {ranking?.weights && (
              <Col md={6} lg={7}>
                <div className="small text-muted">
                  Official scoring: Quiz {weightLabel(ranking.weights.quiz)} · Simulator {weightLabel(ranking.weights.simulator)} · QA {weightLabel(ranking.weights.evaluation)}. Missing components are reweighted by the server.
                </div>
              </Col>
            )}
          </Row>
        </Card.Body>
      </Card>

      {leaderboardLoading ? (
        <LoadingSpinner />
      ) : leaderboardError ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load leaderboard" message={leaderboardError} action={<Button onClick={() => setLeaderboardReloadKey((key) => key + 1)}>Retry</Button>} />
      ) : !ranking ? (
        <EmptyState icon="bi-trophy" title="Select a batch" message="Choose a training batch to view its rankings." />
      ) : rows.length === 0 ? (
        <EmptyState icon="bi-people" title="No agents in this batch" message="This batch has no active agents to rank." />
      ) : (
        <Card>
          <Card.Body>
            {!hasScores && (
              <Alert variant="light" className="small">No completed quiz, simulator, or QA scores are available yet. Agents remain listed with the official server-provided ranks.</Alert>
            )}
            <Row className="g-2 mb-3">
              <Col md={8} lg={6}>
                <SearchBar value={search} onChange={setSearch} placeholder="Search agent name or employee ID..." />
              </Col>
            </Row>

            {filteredRows.length === 0 ? (
              <EmptyState icon="bi-search" title="No matching agents" message="Try a different name or employee ID." />
            ) : (
              <div className="table-responsive">
                <Table hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Agent</th>
                      <th>Quiz</th>
                      <th>Simulator</th>
                      <th>QA</th>
                      <th>Overall</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={agentId(row.agent)}>
                        <td className="fw-bold">#{row.rank}</td>
                        <td>
                          <div className="fw-semibold">{fullName(row.agent)}</div>
                          {row.agent?.employeeId && <div className="small text-muted">{row.agent.employeeId}</div>}
                        </td>
                        <td>{scoreLabel(row.averageQuizScore)}</td>
                        <td>{scoreLabel(row.averageSimulatorScore)}</td>
                        <td>{scoreLabel(row.averageEvaluationScore)}</td>
                        <td className="fw-bold text-primary">{scoreLabel(row.readinessScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}
    </>
  );
}

/**
 * Agent performance trends (feature 3), opened from Batch Progress.
 * Line charts for quiz, simulator and evaluation scores over time + weakest category.
 */
import { useEffect, useState } from 'react';
import { Badge, Modal, Spinner } from 'react-bootstrap';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyticsApi } from '../api/services';
import { getErrorMessage, formatDate } from '../utils/helpers';

const BRAND = '#1d4ed8';
const GREEN = '#157f3d';
const AMBER = '#b45309';
const GRID = '#e2e8f0';

function TrendChart({ title, data, dataKey, color, labelKey }) {
  if (!data.length) return <div className="small text-muted mb-3">{title}: no data yet.</div>;
  const rows = data.map((d, i) => ({ ...d, n: i + 1 }));
  return (
    <div className="mb-3">
      <div className="small fw-semibold mb-1">{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={rows} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="n" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(v) => `${v}%`}
            labelFormatter={(n) => {
              const row = rows[n - 1];
              return `${row?.[labelKey] || ''} · ${formatDate(row?.date)}`;
            }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AgentTrendModal({ agentId, agentName, show, onHide }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!show || !agentId) return;
    setLoading(true);
    setError('');
    setData(null);
    analyticsApi
      .agent(agentId)
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [show, agentId]);

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <div>
          <Modal.Title className="h5">Performance trends</Modal.Title>
          <p className="modal-subtitle">{agentName}</p>
        </div>
      </Modal.Header>
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4"><Spinner size="sm" /></div>
        ) : error ? (
          <div className="text-danger small">{error}</div>
        ) : data ? (
          <>
            {data.weakestCategory && (
              <div className="mb-3">
                Weakest area: <Badge bg="danger">{data.weakestCategory.category} · {data.weakestCategory.averageScore}%</Badge>
              </div>
            )}
            <TrendChart title="Quiz scores" data={data.quizTrend} dataKey="percentage" color={BRAND} labelKey="quiz" />
            <TrendChart title="Simulator (combined)" data={data.simulatorTrend} dataKey="combinedScore" color={GREEN} labelKey="scenario" />
            <TrendChart title="QA evaluations" data={data.evaluationTrend} dataKey="score" color={AMBER} labelKey="date" />
          </>
        ) : null}
      </Modal.Body>
    </Modal>
  );
}

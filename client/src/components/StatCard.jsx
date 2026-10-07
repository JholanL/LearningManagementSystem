import { Card } from 'react-bootstrap';

// Dashboard number tile.  <StatCard label="Agents" value={42} icon="bi-people" tone="teal" hint="+3 this week" />
export default function StatCard({ label, value, icon, tone = 'teal', hint }) {
  return (
    <Card className="stat-card h-100">
      <Card.Body className="d-flex align-items-center gap-3">
        <div className={`stat-icon tone-${tone}`}>
          <i className={`bi ${icon}`} />
        </div>
        <div className="min-w-0">
          <div className="stat-value">{value ?? '-'}</div>
          <div className="stat-label">{label}</div>
          {hint && <div className="stat-hint">{hint}</div>}
        </div>
      </Card.Body>
    </Card>
  );
}

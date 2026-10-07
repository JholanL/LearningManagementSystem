import { Card, Badge } from 'react-bootstrap';
import PageHeader from './PageHeader';

/**
 * TEMPORARY placeholder for pages your team still needs to build.
 * It lists what the page should do and which API functions to use.
 * Replace the whole component once the real page is done.
 */
export default function TodoPage({ title, icon = 'bi-hammer', goal, features = [], apis = [], reference }) {
  return (
    <>
      <PageHeader title={title} icon={icon} subtitle="This page is ready for your team to build." />
      <Card className="todo-card">
        <Card.Body className="p-4">
          <Badge bg="warning" text="dark" className="mb-3">
            <i className="bi bi-cone-striped me-1" /> TO BUILD
          </Badge>
          {goal && <p className="mb-4">{goal}</p>}

          {features.length > 0 && (
            <>
              <h2 className="h6 fw-bold">Features</h2>
              <ul className="mb-4">
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {apis.length > 0 && (
            <>
              <h2 className="h6 fw-bold">API functions (src/api/services.js)</h2>
              <div className="d-flex flex-wrap gap-2 mb-4">
                {apis.map((a) => (
                  <code key={a} className="api-chip">
                    {a}
                  </code>
                ))}
              </div>
            </>
          )}

          {reference && (
            <p className="small text-muted mb-0">
              <i className="bi bi-lightbulb me-1" />
              Pattern to copy: <code>{reference}</code>
            </p>
          )}
        </Card.Body>
      </Card>
    </>
  );
}

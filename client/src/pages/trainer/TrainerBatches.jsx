/**
 * Trainer → My Batches: the waves this trainer handles. Click one to open its
 * progress matrix (BatchProgress).
 */
import { Badge, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import usePaginatedList from '../../hooks/usePaginatedList';
import { batchesApi } from '../../api/services';
import { formatDate } from '../../utils/helpers';

const STATUSES = ['upcoming', 'ongoing', 'completed'];

export default function TrainerBatches() {
  const navigate = useNavigate();
  const list = usePaginatedList(batchesApi.list, { status: '' });

  return (
    <>
      <PageHeader title="My Batches" icon="bi-collection" subtitle="The training waves you handle. Open one to see the progress matrix." />

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={8}><SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by batch name or account..." /></Col>
            <Col md={4}>
              <Form.Select value={list.filters.status} onChange={(e) => list.setFilter('status', e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {list.loading ? (
        <LoadingSpinner />
      ) : list.error ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load batches" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="bi-collection" title="No batches" message="You aren't assigned to any training wave yet." />
      ) : (
        <Row className="g-3">
          {list.items.map((b) => (
            <Col md={6} lg={4} key={b._id}>
              <Card className="h-100 kb-result" role="button" onClick={() => navigate(`/trainer/batches/${b._id}`)}>
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <h2 className="h6 fw-semibold mb-0">{b.name}</h2>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="small text-muted">{b.account}</div>
                  <div className="small text-muted mt-2 flex-grow-1">
                    <i className="bi bi-calendar3 me-1" />{formatDate(b.startDate)} – {formatDate(b.endDate)}
                  </div>
                  <div className="d-flex align-items-center justify-content-between mt-3">
                    <Badge bg="light" text="dark" pill><i className="bi bi-people me-1" />{b.agentCount} agents</Badge>
                    <span className="small text-primary">Open progress <i className="bi bi-arrow-right" /></span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
    </>
  );
}

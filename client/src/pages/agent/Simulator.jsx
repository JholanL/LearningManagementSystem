/**
 * Agent → Call Simulator: pick a scenario to practice.
 * List + search + category/difficulty filters. Each card links to PlayScenario.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Form, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { scenariosApi, metaApi } from '../../api/services';

const MOOD_TONE = { calm: 'badge-green', confused: 'badge-blue', frustrated: 'badge-amber', irate: 'badge-red' };
const DIFF_TONE = { Easy: 'badge-green', Medium: 'badge-amber', Hard: 'badge-red' };

export default function Simulator() {
  const list = usePaginatedList(scenariosApi.list, { category: '', difficulty: '' }, { limit: 9 });

  const [categories, setCategories] = useState([]);
  const [difficulties, setDifficulties] = useState([]);
  useEffect(() => {
    metaApi
      .get()
      .then((res) => {
        setCategories(res.data.scenarioCategories);
        setDifficulties(res.data.scenarioDifficulties);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <PageHeader title="Call Simulator" icon="bi-headset" subtitle="Practice real customer calls. Speak or click your responses and get instant coaching." />

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={6}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search scenarios..." />
            </Col>
            <Col sm={6} md={3}>
              <Form.Select value={list.filters.category} onChange={(e) => list.setFilter('category', e.target.value)} aria-label="Filter by category">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6} md={3}>
              <Form.Select value={list.filters.difficulty} onChange={(e) => list.setFilter('difficulty', e.target.value)} aria-label="Filter by difficulty">
                <option value="">All difficulties</option>
                {difficulties.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {list.loading ? (
        <LoadingSpinner />
      ) : list.error ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load scenarios" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="bi-headset" title="No scenarios yet" message="Your trainer hasn't published any call scenarios for your batch." />
      ) : (
        <Row className="g-3">
          {list.items.map((s) => (
            <Col md={6} lg={4} key={s._id}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column">
                  <div className="d-flex gap-2 mb-2 flex-wrap">
                    <span className={`badge-tone ${DIFF_TONE[s.difficulty] || 'badge-gray'}`}>{s.difficulty}</span>
                    <span className="badge-tone badge-gray">{s.category}</span>
                    {s.passed && <span className="badge-tone badge-green"><i className="bi bi-check-lg" /> Passed</span>}
                  </div>
                  <h2 className="h6 fw-semibold">{s.title}</h2>
                  <p className="small text-muted flex-grow-1">{s.description}</p>
                  <div className="d-flex align-items-center gap-2 small text-muted mb-3">
                    <span className={`badge-tone ${MOOD_TONE[s.customer?.mood] || 'badge-gray'}`}>{s.customer?.mood}</span>
                    <span className="text-truncate">{s.customer?.name}</span>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <span className="small text-muted">
                      {s.attempts > 0 ? (
                        <>
                          <i className="bi bi-arrow-repeat me-1" />{s.attempts} attempt{s.attempts > 1 ? 's' : ''}
                          {s.bestScore != null && <> · best {s.bestScore}%</>}
                        </>
                      ) : (
                        'Not attempted'
                      )}
                    </span>
                    <Button as={Link} to={`/agent/simulator/${s._id}`} size="sm">
                      <i className="bi bi-telephone-outbound me-1" /> {s.attempts > 0 ? 'Retry' : 'Start'}
                    </Button>
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

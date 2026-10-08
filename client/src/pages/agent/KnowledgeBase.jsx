/**
 * Agent → Knowledge Base: a search-first library.
 * Big search box, category chips, popular articles, and results that link to the article page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import usePaginatedList from '../../hooks/usePaginatedList';
import { kbApi } from '../../api/services';

const CATEGORIES = ['Product', 'Billing', 'Technical', 'Process', 'Compliance', 'Scripts'];

export default function KnowledgeBase() {
  const list = usePaginatedList(kbApi.list, { category: '' });
  const [popular, setPopular] = useState([]);
  useEffect(() => {
    kbApi.popular().then((res) => setPopular(res.data)).catch(() => {});
  }, []);

  const hasQuery = !!list.search || !!list.filters.category;

  return (
    <>
      <PageHeader title="Knowledge Base" icon="bi-journal-richtext" subtitle="Search product info, scripts and troubleshooting guides — keep this open during calls." />

      <Card className="mb-3">
        <Card.Body>
          <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search the knowledge base..." />
          <div className="d-flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant={!list.filters.category ? 'primary' : 'outline-secondary'} onClick={() => list.setFilter('category', '')}>All</Button>
            {CATEGORIES.map((c) => (
              <Button key={c} size="sm" variant={list.filters.category === c ? 'primary' : 'outline-secondary'} onClick={() => list.setFilter('category', c)}>
                {c}
              </Button>
            ))}
          </div>
        </Card.Body>
      </Card>

      {/* Popular, only when not actively searching */}
      {!hasQuery && popular.length > 0 && (
        <Card className="mb-3">
          <Card.Header><i className="bi bi-star-fill text-warning me-1" /> Popular articles</Card.Header>
          <Card.Body>
            <Row className="g-2">
              {popular.map((a) => (
                <Col md={6} key={a._id}>
                  <Link to={`/agent/kb/${a.slug}`} className="popular-link">
                    <span className="fw-semibold">{a.title}</span>
                    <span className="small text-muted d-block text-truncate">{a.summary}</span>
                  </Link>
                </Col>
              ))}
            </Row>
          </Card.Body>
        </Card>
      )}

      {list.loading ? (
        <LoadingSpinner />
      ) : list.error ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load articles" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
      ) : list.items.length === 0 ? (
        <EmptyState icon="bi-search" title="No articles found" message="Try different keywords or another category." />
      ) : (
        <Row className="g-3">
          {list.items.map((a) => (
            <Col md={6} key={a._id}>
              <Card className="h-100 kb-result">
                <Card.Body>
                  <div className="d-flex gap-2 mb-1">
                    <span className="badge-tone badge-blue">{a.category}</span>
                  </div>
                  <h2 className="h6 fw-semibold mb-1">
                    <Link to={`/agent/kb/${a.slug}`} className="stretched-link text-decoration-none">{a.title}</Link>
                  </h2>
                  <p className="small text-muted mb-2">{a.summary}</p>
                  {a.tags?.length > 0 && (
                    <div className="d-flex flex-wrap gap-1">
                      {a.tags.map((t) => <span key={t} className="kb-tag">#{t}</span>)}
                    </div>
                  )}
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

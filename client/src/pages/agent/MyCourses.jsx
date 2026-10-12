/**
 * Agent → My Courses: published courses assigned to the agent's batch, with progress.
 * List + search + category/level filters. Each card links to CourseView.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Col, Form, ProgressBar, Row } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import SearchBar from '../../components/SearchBar';
import PaginationBar from '../../components/PaginationBar';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusBadge from '../../components/StatusBadge';
import usePaginatedList from '../../hooks/usePaginatedList';
import { coursesApi, metaApi } from '../../api/services';

const LEVEL_TONE = { Beginner: 'badge-green', Intermediate: 'badge-amber', Advanced: 'badge-red' };
const ACTION_LABEL = { not_started: 'Start', in_progress: 'Continue', completed: 'Review' };

export default function MyCourses() {
  const list = usePaginatedList(coursesApi.list, { category: '', level: '' }, { limit: 9 });

  const [categories, setCategories] = useState([]);
  const [levels, setLevels] = useState([]);
  useEffect(() => {
    metaApi
      .get()
      .then((res) => {
        setCategories(res.data.courseCategories);
        setLevels(res.data.courseLevels);
      })
      .catch(() => {});
  }, []);

  const hasFilters = list.search || list.filters.category || list.filters.level;

  return (
    <>
      <PageHeader title="My Courses" icon="bi-journal-bookmark" subtitle="Your batch's training curriculum. Finish every lesson and pass every quiz to earn a certificate." />

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2">
            <Col md={6}>
              <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search by title or code..." />
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
              <Form.Select value={list.filters.level} onChange={(e) => list.setFilter('level', e.target.value)} aria-label="Filter by level">
                <option value="">All levels</option>
                {levels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {list.loading ? (
        <LoadingSpinner />
      ) : list.error ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load courses" message={list.error} action={<Button onClick={list.reload}>Retry</Button>} />
      ) : list.items.length === 0 ? (
        hasFilters ? (
          <EmptyState icon="bi-search" title="No courses match" message="Try a different search or clear the filters." />
        ) : (
          // Newly registered agents see nothing until an admin adds them to a batch
          <EmptyState icon="bi-journal-bookmark" title="No courses yet" message="You'll see your training courses here once an admin assigns you to a batch." />
        )
      ) : (
        <Row className="g-3">
          {list.items.map((c) => {
            const status = c.progress?.status || 'not_started';
            const percent = c.progress?.percent ?? 0;
            return (
              <Col md={6} lg={4} key={c._id}>
                <Card className="h-100">
                  <Card.Body className="d-flex flex-column">
                    <div className="d-flex gap-2 mb-2 flex-wrap">
                      <span className="badge-tone badge-gray">{c.category}</span>
                      <span className={`badge-tone ${LEVEL_TONE[c.level] || 'badge-gray'}`}>{c.level}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div className="small text-muted fw-semibold">{c.code}</div>
                    <h2 className="h6 fw-semibold">{c.title}</h2>
                    <p className="small text-muted flex-grow-1">{c.description}</p>

                    <div className="d-flex flex-wrap gap-3 small text-muted mb-2">
                      <span><i className="bi bi-file-text me-1" />{c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}</span>
                      <span><i className="bi bi-patch-question me-1" />{c.quizCount} quiz{c.quizCount === 1 ? '' : 'zes'}</span>
                      {c.estimatedHours > 0 && <span><i className="bi bi-clock me-1" />{c.estimatedHours}h</span>}
                    </div>

                    <div className="d-flex justify-content-between small mb-1">
                      <span className="text-muted">Progress</span>
                      <span className="fw-semibold">{percent}%</span>
                    </div>
                    <ProgressBar
                      now={percent}
                      variant={status === 'completed' ? 'success' : undefined}
                      style={{ height: 8 }}
                      className="mb-3"
                      aria-label={`${c.title} progress`}
                    />

                    <Button as={Link} to={`/agent/courses/${c._id}`} size="sm" variant={status === 'completed' ? 'outline-primary' : 'primary'}>
                      {ACTION_LABEL[status]} <i className="bi bi-arrow-right ms-1" />
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
    </>
  );
}

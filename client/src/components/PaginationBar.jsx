import { Pagination } from 'react-bootstrap';

// <PaginationBar pagination={list.pagination} onPageChange={list.setPage} />
export default function PaginationBar({ pagination, onPageChange }) {
  const { page = 1, totalPages = 1, total = 0, limit = 10 } = pagination || {};
  if (!total) return null;

  // Show at most 5 page numbers around the current page
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
      <small className="text-muted">
        Showing {from}-{to} of {total}
      </small>
      {totalPages > 1 && (
        <Pagination size="sm" className="mb-0">
          <Pagination.Prev disabled={page <= 1} onClick={() => onPageChange(page - 1)} />
          {pages.map((p) => (
            <Pagination.Item key={p} active={p === page} onClick={() => onPageChange(p)}>
              {p}
            </Pagination.Item>
          ))}
          <Pagination.Next disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} />
        </Pagination>
      )}
    </div>
  );
}

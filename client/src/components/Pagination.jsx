import BsPagination from 'react-bootstrap/Pagination';

const WINDOW = 5;

// Page numbers around the current page, plus Previous and Next.
export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  let start = Math.max(1, page - Math.floor(WINDOW / 2));
  const end = Math.min(totalPages, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);

  const pages = [];
  for (let n = start; n <= end; n += 1) pages.push(n);

  return (
    <BsPagination className="mb-0" aria-label="Pages">
      <BsPagination.Prev disabled={page <= 1} onClick={() => onChange(page - 1)} />
      {pages.map((n) => (
        <BsPagination.Item key={n} active={n === page} onClick={() => onChange(n)}>
          {n}
        </BsPagination.Item>
      ))}
      <BsPagination.Next disabled={page >= totalPages} onClick={() => onChange(page + 1)} />
    </BsPagination>
  );
}

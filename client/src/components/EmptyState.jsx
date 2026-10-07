export default function EmptyState({ icon = 'bi-inbox', title = 'Nothing here yet', message, action }) {
  return (
    <div className="empty-state text-center py-5 px-3">
      <div className="empty-state-icon mx-auto mb-3">
        <i className={`bi ${icon}`} />
      </div>
      <h2 className="h6 fw-bold mb-1">{title}</h2>
      {message && <p className="text-muted small mb-3">{message}</p>}
      {action}
    </div>
  );
}

// Title row at the top of every page.  <PageHeader title="Batches" subtitle="..." actions={<Button/>} />
export default function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="page-header d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div className="d-flex align-items-center gap-3">
        {icon && (
          <div className="page-header-icon">
            <i className={`bi ${icon}`} />
          </div>
        )}
        <div>
          <h1 className="h4 mb-0 fw-bold">{title}</h1>
          {subtitle && <p className="text-muted mb-0 small">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Offcanvas } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { NAVIGATION } from '../config/navigation';
import { fullName, initials, ROLE_LABEL } from '../utils/helpers';
import NotificationBell from '../components/NotificationBell';
import AdminGlobalSearch from '../components/AdminGlobalSearch';
import BrandMark from '../components/BrandMark';
import ConfirmModal from '../components/ConfirmModal';

function Brand() {
  return (
    <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none">
      <BrandMark size={38} />
      <span className="brand-text">
        VoiceLink
        <span className="brand-sub">Academy</span>
      </span>
    </Link>
  );
}

function Avatar({ user, size = 36 }) {
  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="avatar" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar avatar-initials" style={{ width: size, height: size }}>
      {initials(user)}
    </span>
  );
}

// Breadcrumb from the current route: "Trainer Portal / <section> [/ Details]"
function useBreadcrumb(role) {
  const { pathname } = useLocation();
  const links = NAVIGATION[role] || [];
  // longest matching nav link wins (so /trainer/courses beats /trainer)
  const match = links
    .filter((l) => pathname === l.to || pathname.startsWith(`${l.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  let section = match?.label;
  if (pathname.startsWith('/profile')) section = 'My Profile';
  const isDetail = match && pathname.startsWith(`${match.to}/`);
  return { root: `${ROLE_LABEL[role]} Portal`, section, isDetail };
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const links = NAVIGATION[user.role] || [];
  const crumb = useBreadcrumb(user.role);

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar: fixed on large screens, slide-in drawer on mobile */}
      <Offcanvas show={showMenu} onHide={() => setShowMenu(false)} responsive="lg" className="sidebar">
        <Offcanvas.Header closeButton closeVariant="white" className="sidebar-header">
          <Brand />
        </Offcanvas.Header>
        <Offcanvas.Body className="d-flex flex-column p-0">
          <div className="sidebar-brand d-none d-lg-flex">
            <Brand />
          </div>
          <div className="sidebar-role">{ROLE_LABEL[user.role]} Portal</div>
          <nav className="sidebar-nav flex-grow-1" aria-label="Main navigation">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className="sidebar-link" onClick={() => setShowMenu(false)}>
                <i className={`bi ${link.icon}`} />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </Offcanvas.Body>
      </Offcanvas>

      <div className="app-main">
        <header className="topbar">
          <button type="button" className="btn btn-icon d-lg-none" onClick={() => setShowMenu(true)} aria-label="Open menu">
            <i className="bi bi-list fs-4" />
          </button>

          {/* Breadcrumb (hidden on the smallest screens) */}
          <nav className="breadcrumb-trail d-none d-sm-flex" aria-label="Breadcrumb">
            <span>{crumb.root}</span>
            {crumb.section && (
              <>
                <i className="bi bi-chevron-right" />
                <span className={crumb.isDetail ? '' : 'crumb-current'}>{crumb.section}</span>
              </>
            )}
            {crumb.isDetail && (
              <>
                <i className="bi bi-chevron-right" />
                <span className="crumb-current">Details</span>
              </>
            )}
          </nav>

          {/* Mobile brand (when breadcrumb is hidden) */}
          <div className="d-sm-none">
            <Brand />
          </div>

          <div className="ms-auto d-flex align-items-center gap-2 gap-md-3">
            {user.role === 'admin' ? (
              <AdminGlobalSearch />
            ) : (
              <div className="topbar-search position-relative d-none d-md-block">
                <i className="bi bi-search" />
                <input type="search" className="form-control" placeholder="Search..." aria-label="Search" />
              </div>
            )}
            {user.role !== 'admin' && <NotificationBell />}
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" className="user-toggle d-flex align-items-center gap-2 text-decoration-none">
                <Avatar user={user} />
                <span className="d-none d-sm-flex flex-column text-start lh-sm">
                  <span className="fw-semibold small text-body">{fullName(user)}</span>
                  <span className="text-muted xsmall">{user.batch?.name || ROLE_LABEL[user.role]}</span>
                </span>
              </Dropdown.Toggle>
              <Dropdown.Menu className="shadow-sm">
                <Dropdown.Header>{user.email}</Dropdown.Header>
                <Dropdown.Item as={Link} to="/profile">
                  <i className="bi bi-person me-2" /> My Profile
                </Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item onClick={() => setConfirmLogout(true)} className="text-danger">
                  <i className="bi bi-box-arrow-left me-2" /> Log out
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>

      <ConfirmModal
        show={confirmLogout}
        title="Log out?"
        message="You'll be signed out of VoiceLink Academy. For security, this ends all your active sessions."
        confirmText="Log out"
        variant="danger"
        loading={loggingOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

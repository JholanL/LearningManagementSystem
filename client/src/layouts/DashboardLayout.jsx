import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Dropdown, Offcanvas } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { NAVIGATION } from '../config/navigation';
import { fullName, initials, ROLE_LABEL } from '../utils/helpers';

function Brand() {
  return (
    <Link to="/" className="brand d-flex align-items-center gap-2 text-decoration-none">
      <span className="brand-mark">
        <i className="bi bi-headset" />
      </span>
      <span className="brand-text">
        VoiceLink <span>Academy</span>
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

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const links = NAVIGATION[user.role] || [];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
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
          <div className="sidebar-footer">
            <NavLink to="/profile" className="sidebar-link" onClick={() => setShowMenu(false)}>
              <i className="bi bi-person-circle" />
              <span>My Profile</span>
            </NavLink>
            <button type="button" className="sidebar-link w-100 border-0 bg-transparent text-start" onClick={handleLogout}>
              <i className="bi bi-box-arrow-left" />
              <span>Log out</span>
            </button>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      <div className="app-main">
        <header className="topbar">
          <button type="button" className="btn btn-icon d-lg-none" onClick={() => setShowMenu(true)} aria-label="Open menu">
            <i className="bi bi-list fs-4" />
          </button>
          <div className="d-lg-none">
            <Brand />
          </div>
          <div className="ms-auto">
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
                <Dropdown.Item onClick={handleLogout} className="text-danger">
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
    </div>
  );
}

import { useState } from 'react';
import Offcanvas from 'react-bootstrap/Offcanvas';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import { NAV_ITEMS, ROLE_LABELS } from './navItems';

const getInitials = (name) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

function SidebarContent({ items, onNavigate, onLogout }) {
  return (
    <div className="lms-sidebar__inner">
      <div className="px-2 pb-3">
        <Logo light to="/dashboard" />
      </div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end ?? true}
          className="lms-nav-link"
          onClick={onNavigate}
        >
          <i className={`bi bi-${item.icon}`} aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
      <button type="button" className="lms-nav-link mt-auto" onClick={onLogout}>
        <i className="bi bi-box-arrow-right" aria-hidden="true" />
        Log out
      </button>
    </div>
  );
}

// Sidebar and top bar around every signed-in page.
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const items = NAV_ITEMS[user.role] || [];
  const closeMenu = () => setShowMenu(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="d-flex min-vh-100">
      <aside className="lms-sidebar d-none d-lg-block">
        <SidebarContent items={items} onLogout={handleLogout} />
      </aside>

      <Offcanvas show={showMenu} onHide={closeMenu} className="lms-sidebar d-lg-none">
        <SidebarContent items={items} onNavigate={closeMenu} onLogout={handleLogout} />
      </Offcanvas>

      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: 0 }}>
        <header className="lms-topbar d-flex align-items-center gap-3 px-3 px-md-4">
          <button
            type="button"
            className="lms-icon-btn d-lg-none"
            aria-label="Open menu"
            onClick={() => setShowMenu(true)}
          >
            <i className="bi bi-list" aria-hidden="true" />
          </button>
          <div className="flex-grow-1 small text-body-secondary">
            {ROLE_LABELS[user.role]} portal
          </div>
          <Link
            to="/profile"
            className="d-flex align-items-center gap-2 text-reset text-decoration-none"
            aria-label="My profile"
          >
            <span className="lms-avatar">{getInitials(user.name)}</span>
            <span className="d-none d-sm-flex flex-column lh-sm">
              <span className="fw-semibold small">{user.name}</span>
              <span className="text-body-secondary" style={{ fontSize: '0.75rem' }}>
                {ROLE_LABELS[user.role]}
              </span>
            </span>
          </Link>
        </header>

        <main className="flex-grow-1 p-3 p-md-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

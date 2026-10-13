import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Spinner } from 'react-bootstrap';
import { notificationsApi } from '../api/services';
import { timeAgo } from '../utils/helpers';
import { useToast } from '../context/ToastContext';

const POLL_MS = 30000;

// No pop-ups while the agent is on a live call, a timed quiz or the daily drill (the badge still updates).
const QUIET_PATHS = /^\/agent\/(simulator\/[^/]+|quizzes\/[^/]+|drill)/;

// Bootstrap icon per notification type
const ICONS = {
  'evaluation.new': 'bi-clipboard-check',
  'quiz.result': 'bi-patch-question',
  'agent.at_risk': 'bi-exclamation-triangle',
  'batch.assigned': 'bi-collection',
  'course.published': 'bi-journal-bookmark',
  'endorsement.requested': 'bi-hand-thumbs-up',
  'endorsement.decided': 'bi-hand-thumbs-up',
  'drill.streak': 'bi-fire',
};

// Custom toggle so the bell keeps its styling (no default caret)
const BellToggle = forwardRef(function BellToggle({ unread, onClick }, ref) {
  return (
    <button ref={ref} type="button" className="topbar-bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={onClick}>
      <i className="bi bi-bell" />
      {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
});

export default function NotificationBell() {
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const location = useLocation();
  const seenRef = useRef(null); // ids already known (null until the first fetch)
  const prevCountRef = useRef(null);
  const popUpRef = useRef(() => {});

  // Poll the unread count; pause when the tab is hidden; clear on unmount.
  // When the count changes, fetch the unread list and pop up anything not seen before.
  // The first fetch only records what is already there, so old unread items never pop up.
  useEffect(() => {
    let active = true;
    const fetchCount = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const { count } = await notificationsApi.unreadCount();
        if (!active) return;
        setUnread(count);
        if (seenRef.current && count === prevCountRef.current) return;
        prevCountRef.current = count;

        const res = await notificationsApi.list({ unread: true, limit: 10 });
        if (!active) return;
        if (!seenRef.current) {
          seenRef.current = new Set(res.data.map((n) => n._id));
          return;
        }
        const fresh = res.data.filter((n) => !seenRef.current.has(n._id));
        fresh.forEach((n) => seenRef.current.add(n._id));
        if (fresh.length) popUpRef.current(fresh);
      } catch {
        /* silent: the bell should never break the layout */
      }
    };
    fetchCount();
    const id = setInterval(fetchCount, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && fetchCount();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ limit: 8 });
      setItems(res.data);
      if (typeof res.unreadCount === 'number') setUnread(res.unreadCount);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onToggle = (next) => {
    setOpen(next);
    if (next) loadList();
  };

  const onItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setUnread((u) => Math.max(0, u - 1));
      if (prevCountRef.current) prevCountRef.current -= 1;
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      try {
        await notificationsApi.markRead(n._id);
      } catch {
        /* ignore */
      }
    }
    if (n.link) navigate(n.link);
  };

  const onMarkAll = async () => {
    setUnread(0);
    prevCountRef.current = 0;
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    try {
      await notificationsApi.markAllRead();
    } catch {
      /* ignore */
    }
  };

  // Latest pop-up logic, kept in a ref so the polling effect never goes stale
  useEffect(() => {
    popUpRef.current = (fresh) => {
      if (QUIET_PATHS.test(location.pathname)) return;
      if (fresh.length === 1) {
        const [n] = fresh;
        toast.notification({
          title: n.title,
          message: n.message,
          icon: ICONS[n.type] || 'bi-bell',
          onClick: () => onItem(n),
        });
      } else {
        toast.notification({
          title: `${fresh.length} new notifications`,
          message: fresh.map((n) => n.title).join(' · '),
          icon: 'bi-bell',
          onClick: () => setTimeout(() => onToggle(true), 0), // after this click, so the menu's outside-click doesn't close it
        });
      }
    };
  });

  return (
    <Dropdown align="end" show={open} onToggle={onToggle}>
      <Dropdown.Toggle as={BellToggle} unread={unread} />
      <Dropdown.Menu className="notif-menu shadow">
        <div className="notif-head">
          <span className="fw-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" className="btn btn-link btn-sm p-0 notif-markall" onClick={onMarkAll}>
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-4">
            <Spinner size="sm" />
          </div>
        ) : items.length === 0 ? (
          <div className="notif-empty text-muted">
            <i className="bi bi-bell-slash d-block mb-1" />
            You&apos;re all caught up.
          </div>
        ) : (
          <div className="notif-list">
            {items.map((n) => (
              <button key={n._id} type="button" className={`notif-item ${n.read ? '' : 'is-unread'}`} onClick={() => onItem(n)}>
                <span className="notif-item-icon">
                  <i className={`bi ${ICONS[n.type] || 'bi-bell'}`} />
                </span>
                <span className="notif-item-body min-w-0">
                  <span className="notif-item-title">{n.title}</span>
                  <span className="notif-item-msg">{n.message}</span>
                  <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="notif-dot" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

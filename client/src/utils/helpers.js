// Small helpers used across pages

// Best human-readable message from an Axios error
export const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err?.response) return 'Cannot reach the server. Check your connection or if the API is running.';
  return err.response.data?.message || fallback;
};

// Server validation errors as { fieldName: 'message' } for showing under inputs
export const getFieldErrors = (err) =>
  (err?.response?.data?.errors || []).reduce((acc, e) => {
    if (e.field && !acc[e.field]) acc[e.field] = e.message;
    return acc;
  }, {});

export const formatDate = (value, opts = { year: 'numeric', month: 'short', day: 'numeric' }) =>
  value ? new Date(value).toLocaleDateString('en-PH', opts) : '-';

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

// Short relative time, e.g. "just now", "5m", "3h", "2d", else a date.
export const timeAgo = (value) => {
  if (!value) return '';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(value);
};

// For <input type="date"> values
export const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

export const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : '-');

export const initials = (user) => (user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '?');

export const ROLE_HOME = { admin: '/admin', trainer: '/trainer', agent: '/agent' };

export const ROLE_LABEL = { admin: 'Administrator', trainer: 'Trainer', agent: 'Agent' };

// YouTube watch/share link -> embeddable URL (returns null if not YouTube)
export const toYouTubeEmbed = (url) => {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

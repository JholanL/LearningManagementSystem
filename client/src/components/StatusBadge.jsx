// Consistent, tinted colors for every status/role label in the app.
// Each entry is [tone family, label]. Tone families are styled in index.css
// (.badge-green / -amber / -red / -blue / -navy / -gray) as soft bg + dark text.
const MAP = {
  // batch
  upcoming: ['blue', 'Upcoming'],
  ongoing: ['green', 'Ongoing'],
  completed: ['gray', 'Completed'],
  // progress
  not_started: ['gray', 'Not started'],
  in_progress: ['amber', 'In progress'],
  // roles
  admin: ['navy', 'Admin'],
  trainer: ['blue', 'Trainer'],
  agent: ['blue', 'Agent'],
  // generic
  published: ['green', 'Published'],
  draft: ['gray', 'Draft'],
  active: ['green', 'Active'],
  inactive: ['red', 'Inactive'],
  passed: ['green', 'Passed'],
  failed: ['red', 'Failed'],
};

export default function StatusBadge({ status, label }) {
  const [tone, text] = MAP[status] || ['gray', status];
  return <span className={`badge-tone badge-${tone} status-badge`}>{label || text}</span>;
}

import { Badge } from 'react-bootstrap';

// Consistent colors for every status/role label in the app
const MAP = {
  // batch
  upcoming: ['info', 'Upcoming'],
  ongoing: ['success', 'Ongoing'],
  completed: ['secondary', 'Completed'],
  // progress
  not_started: ['light', 'Not started'],
  in_progress: ['warning', 'In progress'],
  // roles
  admin: ['dark', 'Admin'],
  trainer: ['primary', 'Trainer'],
  agent: ['info', 'Agent'],
  // generic
  published: ['success', 'Published'],
  draft: ['light', 'Draft'],
  active: ['success', 'Active'],
  inactive: ['danger', 'Inactive'],
  passed: ['success', 'Passed'],
  failed: ['danger', 'Failed'],
};

export default function StatusBadge({ status, label }) {
  const [bg, text] = MAP[status] || ['secondary', status];
  return (
    <Badge bg={bg} text={bg === 'light' || bg === 'warning' ? 'dark' : undefined} className="status-badge">
      {label || text}
    </Badge>
  );
}

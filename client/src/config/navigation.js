// Sidebar menu per role. Add a page = add a line here + a <Route> in App.jsx
export const NAVIGATION = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'bi-grid-1x2', end: true },
    { to: '/admin/users', label: 'Users', icon: 'bi-people' },
    { to: '/admin/batches', label: 'Batches', icon: 'bi-collection' },
    { to: '/admin/courses', label: 'Courses', icon: 'bi-journal-bookmark' },
    { to: '/admin/certificates', label: 'Certificates', icon: 'bi-award' },
    { to: '/admin/kb', label: 'Knowledge Base', icon: 'bi-journal-richtext' },
    { to: '/admin/endorsements', label: 'Endorsements', icon: 'bi-hand-thumbs-up' },
    { to: '/admin/leaderboard', label: 'Leaderboard', icon: 'bi-trophy' },
    { to: '/admin/audit-logs', label: 'Audit Log', icon: 'bi-shield-check' },
  ],
  trainer: [
    { to: '/trainer', label: 'Dashboard', icon: 'bi-grid-1x2', end: true },
    { to: '/trainer/batches', label: 'My Batches', icon: 'bi-collection' },
    { to: '/trainer/courses', label: 'Courses', icon: 'bi-journal-bookmark' },
    { to: '/trainer/scenarios', label: 'Call Simulator', icon: 'bi-headset' },
    { to: '/trainer/evaluations', label: 'QA Evaluations', icon: 'bi-clipboard-check' },
    { to: '/trainer/kb', label: 'Knowledge Base', icon: 'bi-journal-richtext' },
    { to: '/trainer/leaderboard', label: 'Leaderboard', icon: 'bi-trophy' },
  ],
  agent: [
    { to: '/agent', label: 'Dashboard', icon: 'bi-grid-1x2', end: true },
    { to: '/agent/courses', label: 'My Courses', icon: 'bi-journal-bookmark' },
    { to: '/agent/drill', label: 'Daily Drill', icon: 'bi-lightning-charge' },
    { to: '/agent/simulator', label: 'Call Simulator', icon: 'bi-headset' },
    { to: '/agent/kb', label: 'Knowledge Base', icon: 'bi-journal-richtext' },
    { to: '/agent/evaluations', label: 'My Evaluations', icon: 'bi-clipboard-check' },
    { to: '/agent/certificates', label: 'Certificates', icon: 'bi-award' },
    { to: '/agent/leaderboard', label: 'Leaderboard', icon: 'bi-trophy' },
  ],
};

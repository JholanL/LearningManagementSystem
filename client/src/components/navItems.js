// Sidebar links per role. Add an entry here when a new page is ready.
// `icon` is a Bootstrap Icons name: https://icons.getbootstrap.com
// `end: false` keeps the link highlighted on pages below it (e.g. /instructor/courses/123).
const PROFILE = { to: '/profile', label: 'Profile', icon: 'person-circle' };

export const NAV_ITEMS = {
  student: [{ to: '/student', label: 'Dashboard', icon: 'house' }, PROFILE],
  instructor: [
    { to: '/instructor', label: 'My Courses', icon: 'journal-bookmark', end: false },
    PROFILE,
  ],
  admin: [{ to: '/admin', label: 'Dashboard', icon: 'house' }, PROFILE],
};

export const ROLE_LABELS = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
};

import { useAuth } from '../context/AuthContext';

// Placeholder landing page per role until the real dashboards are built.
const COPY = {
  student: {
    title: 'No courses yet',
    text: 'Courses you enroll in will show up here with your progress and deadlines.',
  },
  admin: {
    title: 'Nothing to review yet',
    text: 'User accounts and system-wide numbers will show up here.',
  },
};

export default function RoleDashboard() {
  const { user } = useAuth();
  const copy = COPY[user.role];
  const firstName = user.name.split(' ')[0];

  return (
    <>
      <h1 className="font-display fs-2 mb-1">Welcome, {firstName}</h1>
      <p className="text-body-secondary mb-4">Signed in as {user.email}</p>

      <div className="lms-card p-4 p-md-5 text-center">
        <h2 className="fs-5 fw-bold">{copy.title}</h2>
        <p className="text-body-secondary mb-0">{copy.text}</p>
      </div>
    </>
  );
}

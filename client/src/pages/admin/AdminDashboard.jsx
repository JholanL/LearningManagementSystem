import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function AdminDashboard() {
  return (
    <TodoPage
      title={"Admin Dashboard"}
      icon={"bi-grid-1x2"}
      goal={"System-wide overview for the training manager."}
      features={[
        "Stat cards: total users per role, inactive users, batches by status, published courses, certificates issued",
        "Chart or bars: courses per category (data.courses.byCategory)",
        "Recent users table and recent certificates list",
        "Use <StatCard /> for the number tiles",
      ]}
      apis={["dashboardApi.admin()"]}
      reference={"useFetch() hook + components/StatCard.jsx"}
    />
  );
}

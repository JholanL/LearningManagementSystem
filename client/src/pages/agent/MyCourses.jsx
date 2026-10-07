import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function MyCourses() {
  return (
    <TodoPage
      title={"My Courses"}
      icon={"bi-journal-bookmark"}
      goal={"Courses assigned to the agent's batch, each with progress."}
      features={[
        "Course cards with category, level, lesson/quiz count and a ProgressBar (course.progress.percent)",
        "Search + category filter + pagination",
        "Status badge: Not started / In progress / Completed",
      ]}
      apis={["coursesApi.list(params)"]}
      reference={"pages/admin/ManageBatches.jsx (list part only)"}
    />
  );
}

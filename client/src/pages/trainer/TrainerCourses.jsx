import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TrainerCourses() {
  return (
    <TodoPage
      title={"Courses"}
      icon={"bi-journal-bookmark"}
      goal={"Course catalog management (trainers can edit only the courses they created; admin can edit all)."}
      features={[
        "Course cards/table with search, category + level + published filters, pagination",
        "\"Only mine\" toggle (mine=true)",
        "Create/Edit modal: code, title, description, category, level, passing score, max attempts, hours, thumbnail URL",
        "Publish/Unpublish toggle (API requires at least 1 lesson)",
        "Delete with ConfirmModal",
        "Click a course -> Course Builder",
      ]}
      apis={["coursesApi.list(params)", "coursesApi.create(data)", "coursesApi.update(id, data)", "coursesApi.togglePublish(id)", "coursesApi.remove(id)", "metaApi.get()"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

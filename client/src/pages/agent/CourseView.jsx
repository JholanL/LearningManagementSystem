import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function CourseView() {
  return (
    <TodoPage
      title={"Course"}
      icon={"bi-journal-text"}
      goal={"Route: /agent/courses/:id - course outline."}
      features={[
        "Header with progress bar",
        "Lessons list with check marks (lesson.completed) -> open lesson",
        "Quizzes list: best score, attempts used / max, passed badge -> Take quiz",
        "Certificate card when completed (link to /verify/:code)",
      ]}
      apis={["coursesApi.get(id)"]}
      reference={"useFetch() hook"}
    />
  );
}

import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function CourseBuilder() {
  return (
    <TodoPage
      title={"Course Builder"}
      icon={"bi-tools"}
      goal={"Route: /trainer/courses/:id (also used by admin) - manage the lessons and quizzes inside a course."}
      features={[
        "Course info header with Publish toggle",
        "Lessons list sorted by order: add / edit / delete (title, content, YouTube URL, order, minutes)",
        "Quizzes list: add / edit / delete -> opens Quiz Builder",
        "Preview lesson content",
      ]}
      apis={["coursesApi.get(id)", "coursesApi.createLesson(courseId, data)", "lessonsApi.update(id, data)", "lessonsApi.remove(id)", "coursesApi.createQuiz(courseId, data)", "quizzesApi.remove(id)"]}
      reference={"pages/admin/ManageBatches.jsx (modal form)"}
    />
  );
}

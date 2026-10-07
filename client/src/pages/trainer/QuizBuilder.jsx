import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function QuizBuilder() {
  return (
    <TodoPage
      title={"Quiz Builder"}
      icon={"bi-ui-checks"}
      goal={"Routes: /trainer/courses/:courseId/quizzes/new and /trainer/quizzes/:id - dynamic form for questions."}
      features={[
        "Title, description, time limit (0 = none)",
        "Add / remove questions; each has 2-6 options, a radio for the correct answer, explanation, points",
        "Validate before saving (every question has text, options, and a correct answer)",
        "View attempts table (quizzesApi.attempts)",
      ]}
      apis={["quizzesApi.get(id)", "coursesApi.createQuiz(courseId, data)", "quizzesApi.update(id, data)", "quizzesApi.attempts(id, params)"]}
      reference={"Dynamic arrays in state: setForm({...form, questions: [...form.questions, newQuestion]})"}
    />
  );
}

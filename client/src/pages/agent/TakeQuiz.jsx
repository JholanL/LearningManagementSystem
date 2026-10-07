import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TakeQuiz() {
  return (
    <TodoPage
      title={"Take Quiz"}
      icon={"bi-pencil-square"}
      goal={"Route: /agent/quizzes/:id - answer and submit a quiz."}
      features={[
        "Intro screen: questions, passing score, attempts left, time limit",
        "One question per page or all on one page; radio options",
        "Countdown timer when timeLimitMinutes > 0 (auto-submit at 0)",
        "Confirm before submitting if some answers are blank",
        "Result screen: score, passed/failed, review (correct answers only shown when answersRevealed)",
        "Celebrate if a certificate was issued",
      ]}
      apis={["quizzesApi.get(id)", "quizzesApi.submit(id, answers, timeTakenSeconds)"]}
      reference={"useState for answers array"}
    />
  );
}

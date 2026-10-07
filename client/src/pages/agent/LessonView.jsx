import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function LessonView() {
  return (
    <TodoPage
      title={"Lesson"}
      icon={"bi-play-btn"}
      goal={"Route: /agent/lessons/:id - read/watch a lesson."}
      features={[
        "Render content (keep line breaks: style white-space: pre-line)",
        "Embed YouTube with toYouTubeEmbed() from utils/helpers",
        "\"Mark as complete\" button, then go to nextLesson",
        "Previous / Next navigation",
      ]}
      apis={["lessonsApi.get(id)", "lessonsApi.complete(id)"]}
      reference={"useFetch() hook"}
    />
  );
}

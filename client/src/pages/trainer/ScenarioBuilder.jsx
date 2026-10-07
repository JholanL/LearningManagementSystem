import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function ScenarioBuilder() {
  return (
    <TodoPage
      title={"Scenario Builder"}
      icon={"bi-diagram-3"}
      goal={"Routes: /trainer/scenarios/new and /trainer/scenarios/:id - build a branching conversation."}
      features={[
        "Briefing: title, category, difficulty, customer name/mood/issue, passing score",
        "Steps: each has a key (e.g. \"verify\"), the customer line, and 2-4 agent options",
        "Each option: text, score 0-10, feedback, and \"next step\" dropdown (or End call)",
        "Start step dropdown. The API rejects options that point to missing steps.",
      ]}
      apis={["scenariosApi.get(id)", "scenariosApi.create(data)", "scenariosApi.update(id, data)"]}
      reference={"Seed example: server/src/seed/seedData.js -> scenarios"}
    />
  );
}

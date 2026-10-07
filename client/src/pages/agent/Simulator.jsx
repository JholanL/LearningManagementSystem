import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function Simulator() {
  return (
    <TodoPage
      title={"Call Simulator"}
      icon={"bi-headset"}
      goal={"Pick a call scenario to practice."}
      features={[
        "Scenario cards: category, difficulty, customer mood, best score, attempts",
        "Search + category/difficulty filters",
      ]}
      apis={["scenariosApi.list(params)"]}
      reference={"pages/admin/ManageBatches.jsx (list part only)"}
    />
  );
}

import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TrainerDashboard() {
  return (
    <TodoPage
      title={"Trainer Dashboard"}
      icon={"bi-grid-1x2"}
      goal={"Snapshot of the trainer's batches and who needs help."}
      features={[
        "Stat cards: total agents, average quiz score, pass rate, pending evaluation acknowledgments",
        "My batches list with agent counts and status",
        "AT-RISK AGENTS card (data.atRiskAgents) - highlight agents below 75% or locked out of a quiz",
        "Recent quiz attempts feed",
      ]}
      apis={["dashboardApi.trainer()"]}
      reference={"useFetch() hook + components/StatCard.jsx"}
    />
  );
}

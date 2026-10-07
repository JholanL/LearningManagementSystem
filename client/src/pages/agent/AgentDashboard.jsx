import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function AgentDashboard() {
  return (
    <TodoPage
      title={"My Dashboard"}
      icon={"bi-grid-1x2"}
      goal={"The agent's home: training progress and what to do next."}
      features={[
        "Welcome card with batch name, account and trainer",
        "\"Production Ready\" banner when progress.productionReady is true",
        "Overall progress ring/bar + stat cards: courses completed, avg quiz score, certificates, simulator avg",
        "\"Continue learning\" button (data.continueLearning)",
        "Course progress list, latest evaluation, recent quiz attempts",
      ]}
      apis={["dashboardApi.agent()"]}
      reference={"useFetch() hook + components/StatCard.jsx"}
    />
  );
}

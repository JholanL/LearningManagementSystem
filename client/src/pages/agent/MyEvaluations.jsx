import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function MyEvaluations() {
  return (
    <TodoPage
      title={"My Evaluations"}
      icon={"bi-clipboard-check"}
      goal={"QA scorecards from the trainer."}
      features={[
        "List with overall score, rating, date, acknowledged badge",
        "Detail modal: score per criterion, strengths, improvements, coaching plan",
        "\"Acknowledge\" button with optional comment",
      ]}
      apis={["evaluationsApi.list(params)", "evaluationsApi.get(id)", "evaluationsApi.acknowledge(id, comment)", "evaluationsApi.criteria()"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TrainerEvaluations() {
  return (
    <TodoPage
      title={"QA Evaluations"}
      icon={"bi-clipboard-check"}
      goal={"Score agents' mock calls with a weighted QA scorecard and coaching notes."}
      features={[
        "List with agent filter, acknowledged filter, search, pagination",
        "Form: agent (from your batches), call type, summary, 6 criteria rated 1-5 (labels/weights from evaluationsApi.criteria()), strengths, improvements, coaching plan",
        "Show computed overall score + rating after saving",
        "Acknowledged evaluations are locked (API returns 400 on edit)",
      ]}
      apis={["evaluationsApi.list(params)", "evaluationsApi.criteria()", "evaluationsApi.create(data)", "evaluationsApi.update(id, data)", "evaluationsApi.remove(id)", "batchesApi.get(id)"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

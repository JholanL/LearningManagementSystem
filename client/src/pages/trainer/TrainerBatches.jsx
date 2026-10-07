import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TrainerBatches() {
  return (
    <TodoPage
      title={"My Batches"}
      icon={"bi-collection"}
      goal={"Batches handled by this trainer (the API returns only their own)."}
      features={[
        "Cards or table of batches with status, schedule and agent count",
        "Button to open the progress matrix (/trainer/batches/:id)",
      ]}
      apis={["batchesApi.list(params)"]}
      reference={"pages/admin/ManageBatches.jsx (list part only)"}
    />
  );
}

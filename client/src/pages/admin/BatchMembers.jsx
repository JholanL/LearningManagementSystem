import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function BatchMembers() {
  return (
    <TodoPage
      title={"Batch Members"}
      icon={"bi-person-lines-fill"}
      goal={"Route: /admin/batches/:id - view a batch and choose which agents belong to it."}
      features={[
        "Show batch info, trainer and curriculum",
        "Checklist of agents (usersApi.list({ role: \"agent\", limit: 100 })) - checked = in this batch",
        "Save sends ALL selected agent ids at once",
        "Add a \"Members\" button in ManageBatches that links here",
      ]}
      apis={["batchesApi.get(id)", "batchesApi.setAgents(id, agentIds)", "usersApi.list(params)"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

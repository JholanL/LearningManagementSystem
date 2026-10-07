import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function TrainerScenarios() {
  return (
    <TodoPage
      title={"Call Simulator Scenarios"}
      icon={"bi-headset"}
      goal={"Manage branching call scenarios used by the agent Call Simulator."}
      features={[
        "List with search + category/difficulty/published filters + pagination",
        "Publish/Unpublish and delete",
        "Button to create / edit -> Scenario Builder",
        "View attempts per scenario",
      ]}
      apis={["scenariosApi.list(params)", "scenariosApi.togglePublish(id)", "scenariosApi.remove(id)", "scenariosApi.attempts(id)"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

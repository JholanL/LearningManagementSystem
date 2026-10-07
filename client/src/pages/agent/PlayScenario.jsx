import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function PlayScenario() {
  return (
    <TodoPage
      title={"Call in progress"}
      icon={"bi-telephone-inbound"}
      goal={"Route: /agent/simulator/:id - chat-style simulated call."}
      features={[
        "Briefing card (customer name, mood, issue) then \"Answer call\"",
        "Chat bubbles: customer line, then the 2-4 response buttons",
        "After each choice call respond() -> show feedback + points, then the next customer line",
        "Keep the path array: [{ stepKey, optionIndex }]",
        "When ended=true call submit(path) -> show score, passed, and full transcript with feedback",
      ]}
      apis={["scenariosApi.get(id)", "scenariosApi.respond(id, stepKey, optionIndex)", "scenariosApi.submit(id, path)"]}
      reference={"Test data: \"Billing Dispute: Unexpected Charge\" from the seed"}
    />
  );
}

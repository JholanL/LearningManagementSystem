import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function ManageCertificates() {
  return (
    <TodoPage
      title={"Certificates"}
      icon={"bi-award"}
      goal={"All certificates issued by the system."}
      features={[
        "Table: code, agent, course, final score, issue date",
        "Search by agent name or code + pagination",
        "Link each code to the public page /verify/:code",
      ]}
      apis={["certificatesApi.list(params)"]}
      reference={"pages/admin/ManageBatches.jsx (list part only)"}
    />
  );
}

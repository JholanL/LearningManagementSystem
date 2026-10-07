import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function ManageUsers() {
  return (
    <TodoPage
      title={"User Management"}
      icon={"bi-people"}
      goal={"Create, edit, deactivate, unlock and delete admin / trainer / agent accounts."}
      features={[
        "Table with search (name, email, employee ID) + filters (role, batch, active) + pagination",
        "Create/Edit modal: name, email, password (required on create), role, employee ID, phone, batch (agents only)",
        "Activate/Deactivate toggle and \"Unlock\" button for locked accounts",
        "Delete with ConfirmModal (an admin cannot delete themselves - the API blocks it)",
      ]}
      apis={["usersApi.list(params)", "usersApi.create(data)", "usersApi.update(id, data)", "usersApi.toggleStatus(id)", "usersApi.unlock(id)", "usersApi.remove(id)", "batchesApi.list({ limit: 100 })"]}
      reference={"pages/admin/ManageBatches.jsx"}
    />
  );
}

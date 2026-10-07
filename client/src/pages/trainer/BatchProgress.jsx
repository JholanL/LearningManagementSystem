import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function BatchProgress() {
  return (
    <TodoPage
      title={"Batch Progress"}
      icon={"bi-table"}
      goal={"Route: /trainer/batches/:id - class record style matrix: agents (rows) x courses (columns)."}
      features={[
        "Each cell: progress % with a small ProgressBar and status color",
        "Overall % column and a \"Production Ready\" badge per agent",
        "Search box to filter agents by name (client-side)",
        "Optional: export the table to CSV",
      ]}
      apis={["progressApi.batch(batchId)", "batchesApi.get(id)"]}
      reference={"useFetch() hook"}
    />
  );
}

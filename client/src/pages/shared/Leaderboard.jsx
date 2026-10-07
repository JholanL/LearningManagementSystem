import TodoPage from '../../components/TodoPage';

// TODO: replace this placeholder with the real page.
export default function Leaderboard() {
  return (
    <TodoPage
      title={"Leaderboard"}
      icon={"bi-trophy"}
      goal={"Batch ranking by Readiness Score (quiz 50% + simulator 30% + QA 20%). Used by all roles."}
      features={[
        "Agent: API automatically uses their own batch; highlight their row (row.isMe)",
        "Admin/Trainer: batch dropdown (batchesApi.list) then leaderboardApi.get(batchId)",
        "Top 3 podium + full table: rank, agent, courses completed, quiz/simulator/QA averages, readiness score",
      ]}
      apis={["leaderboardApi.get(batchId)", "batchesApi.list(params)"]}
      reference={"useAuth() to check user.role"}
    />
  );
}

// Production-status badge (feature 5). Drop into user lists, the leaderboard, etc.
// Hidden for in_training unless `always` is set.
const MAP = {
  production: ['badge-green', 'Production'],
  endorsed: ['badge-amber', 'Endorsed'],
  in_training: ['badge-gray', 'In training'],
};

export default function ProductionBadge({ status, always = false }) {
  if (!status || (status === 'in_training' && !always)) return null;
  const [tone, label] = MAP[status] || ['badge-gray', status];
  return <span className={`badge-tone ${tone}`}>{label}</span>;
}

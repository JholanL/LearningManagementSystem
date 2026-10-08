// Agent production-journey timeline (feature 5): In training → Endorsed → Production.
import { formatDate } from '../utils/helpers';

const STEPS = [
  { key: 'in_training', label: 'In training', icon: 'bi-mortarboard' },
  { key: 'endorsed', label: 'Endorsed', icon: 'bi-hand-thumbs-up' },
  { key: 'production', label: 'Production', icon: 'bi-headset' },
];
const ORDER = { in_training: 0, endorsed: 1, production: 2 };

export default function ProductionTimeline({ status = 'in_training', goLiveAt }) {
  const current = ORDER[status] ?? 0;
  return (
    <div className="prod-timeline">
      {STEPS.map((s, i) => (
        <div key={s.key} className={`prod-step ${i <= current ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          <span className="prod-dot"><i className={`bi ${s.icon}`} /></span>
          <span className="prod-label">{s.label}</span>
          {s.key === 'production' && goLiveAt && i <= current && <span className="prod-date">{formatDate(goLiveAt)}</span>}
          {i < STEPS.length - 1 && <span className="prod-line" />}
        </div>
      ))}
    </div>
  );
}

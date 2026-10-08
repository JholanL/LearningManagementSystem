import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();

const HIGHLIGHTS = [
  { icon: 'bi-journal-check', title: 'Structured courses', text: 'Lessons and graded quizzes per training wave.' },
  { icon: 'bi-headset', title: 'Call simulator', text: 'Branching customer calls with instant coaching.' },
  { icon: 'bi-award', title: 'Verifiable certificates', text: 'Earn a code anyone can verify online.' },
];

// Split screen used by Login and Register
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-hero d-none d-lg-flex">
        <div className="auth-hero-inner">
          <div className="brand-mark brand-mark-lg mb-4">
            <i className="bi bi-headset" />
          </div>
          <div className="auth-overline">VoiceLink Solutions · Agent Academy</div>
          <h2 className="display-6 fw-bold mb-3">
            Train agents who are <span className="text-accent">ready for the floor.</span>
          </h2>
          <p className="lead opacity-75 mb-0">
            Structured courses, graded assessments, and realistic call simulations for new-hire call center agents.
          </p>

          <div className="auth-tiles">
            {HIGHLIGHTS.map((h) => (
              <div key={h.title} className="auth-tile">
                <span className="auth-tile-icon">
                  <i className={`bi ${h.icon}`} />
                </span>
                <span className="auth-tile-text">
                  <strong>{h.title}</strong>
                  <span>{h.text}</span>
                </span>
              </div>
            ))}
          </div>

          <p className="auth-footer-note mt-4 mb-0">© {YEAR} VoiceLink Solutions — training platform for the Lumina Telecom account.</p>
        </div>
      </aside>

      <section className="auth-form-side">
        <div className="auth-card">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-4 d-lg-none">
            <span className="brand-mark">
              <i className="bi bi-headset" />
            </span>
            <span className="fw-bold text-body">VoiceLink Academy</span>
          </Link>
          <h1 className="h3 fw-bold mb-1">{title}</h1>
          {subtitle && <p className="text-muted mb-4">{subtitle}</p>}
          {children}
        </div>
        <p className="small text-muted mt-4 mb-0">
          Have a certificate code? <Link to="/verify">Verify a certificate</Link>
        </p>
      </section>
    </div>
  );
}

import { Link } from 'react-router-dom';

// Split screen used by Login and Register
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-page">
      <aside className="auth-hero d-none d-lg-flex">
        <div className="auth-hero-inner">
          <div className="brand-mark brand-mark-lg mb-4">
            <i className="bi bi-headset" />
          </div>
          <h2 className="display-6 fw-bold mb-3">
            Train agents who are <span className="text-accent">ready for the floor.</span>
          </h2>
          <p className="lead opacity-75 mb-4">
            VoiceLink Academy prepares new-hire call center agents with structured courses, graded assessments, and realistic call simulations.
          </p>
          <ul className="auth-hero-list list-unstyled">
            <li>
              <i className="bi bi-journal-check" /> Courses and quizzes per training wave
            </li>
            <li>
              <i className="bi bi-headset" /> Branching call simulator with instant feedback
            </li>
            <li>
              <i className="bi bi-clipboard-check" /> QA scorecards and coaching
            </li>
            <li>
              <i className="bi bi-award" /> Verifiable completion certificates
            </li>
          </ul>
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

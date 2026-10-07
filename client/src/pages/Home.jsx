import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Row from 'react-bootstrap/Row';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  {
    icon: 'mortarboard',
    title: 'Student',
    text: 'Enrolls in courses, reads lessons, submits assignments, and checks grades and progress.',
  },
  {
    icon: 'easel',
    title: 'Instructor',
    text: 'Creates courses and lessons, posts assignments and announcements, then grades what students submit.',
  },
  {
    icon: 'shield-check',
    title: 'Admin',
    text: 'Manages user accounts and roles, oversees every course, and watches system-wide numbers.',
  },
];

const FEATURES = [
  {
    title: 'Courses and lessons',
    text: 'Organize a subject into ordered lessons with text, links, and video.',
  },
  {
    title: 'Assignments',
    text: 'Set a due date, collect file submissions, and return a grade with feedback.',
  },
  {
    title: 'Gradebook',
    text: 'Every score per course in one table, for students and instructors.',
  },
  {
    title: 'Announcements',
    text: "Instructors post updates that show up on each enrolled student's dashboard.",
  },
  {
    title: 'Progress tracking',
    text: 'Mark lessons complete and see how far along each course is.',
  },
  {
    title: 'Search and filters',
    text: 'Find a course or a user quickly, with results split into pages.',
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar expand="md" className="lms-topnav py-3">
        <Container>
          <Navbar.Brand as="div" className="p-0">
            <Logo />
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="site-nav" />
          <Navbar.Collapse id="site-nav">
            <Nav className="me-auto ms-md-4 gap-md-2">
              <Nav.Link href="#roles">Who it is for</Nav.Link>
              <Nav.Link href="#features">Features</Nav.Link>
            </Nav>
            <div className="d-flex gap-2 py-2 py-md-0">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary">
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-link text-decoration-none fw-semibold">
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn-primary">
                    Sign up
                  </Link>
                </>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <section className="lms-hero py-5">
        <Container className="py-lg-4">
          <Row className="align-items-center g-5">
            <Col lg={7}>
              <span className="lms-eyebrow mb-4">Learning Management System</span>
              <h1 className="font-display mb-4">Your classes, lessons, and grades in one place.</h1>
              <p className="lead mb-4" style={{ maxWidth: 520 }}>
                Students enroll and keep up with coursework. Instructors build courses and grade
                submissions. Admins keep accounts in order.
              </p>
              <div className="d-flex flex-wrap gap-3">
                {user ? (
                  <Link to="/dashboard" className="btn btn-accent btn-lg px-4">
                    Go to dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-accent btn-lg px-4">
                      Create an account
                    </Link>
                    <Link to="/login" className="btn btn-outline-on-deep btn-lg px-4">
                      Log in
                    </Link>
                  </>
                )}
              </div>
            </Col>

            {/* Illustration of a student's dashboard, not live data. */}
            <Col lg={5} aria-hidden="true">
              <div className="lms-card p-4 text-body">
                <div className="small fw-semibold text-body-secondary text-uppercase mb-3">
                  Continue learning
                </div>
                <div className="rounded-4 p-3 mb-3" style={{ background: 'var(--lms-tint)' }}>
                  <div className="font-display fs-5" style={{ color: 'var(--lms-deep)' }}>
                    Advanced Web Programming
                  </div>
                  <div className="small mb-2">Lesson 7 of 12 · JWT authentication</div>
                  <div className="lms-progress mb-2">
                    <div style={{ width: '58%' }} />
                  </div>
                  <div className="small fw-semibold">58% complete</div>
                </div>
                <div className="d-flex align-items-center gap-3 py-2 border-bottom">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">Assignment 3: REST API</div>
                    <div className="small text-body-secondary">Advanced Web Programming</div>
                  </div>
                  <span className="lms-pill lms-pill--amber">Due Friday</span>
                </div>
                <div className="d-flex align-items-center gap-3 pt-3">
                  <div className="flex-grow-1">
                    <div className="fw-semibold">Assignment 2: React forms</div>
                    <div className="small text-body-secondary">Graded with feedback</div>
                  </div>
                  <span className="lms-pill">92 / 100</span>
                </div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <section id="roles" className="py-5">
        <Container>
          <h2 className="font-display fs-1 mb-2">Three kinds of users</h2>
          <p className="text-body-secondary mb-4">
            Each role signs in to its own dashboard and only sees what it is allowed to.
          </p>
          <Row className="g-4">
            {ROLES.map((role) => (
              <Col md={4} key={role.title}>
                <div className="lms-card h-100 p-4">
                  <div className="lms-icon-tile mb-3">
                    <i className={`bi bi-${role.icon}`} aria-hidden="true" />
                  </div>
                  <h3 className="font-display fs-4">{role.title}</h3>
                  <p className="text-body-secondary mb-0">{role.text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <section id="features" className="pb-5">
        <Container>
          <h2 className="font-display fs-1 mb-4">What you can do</h2>
          <Row className="g-3">
            {FEATURES.map((feature) => (
              <Col sm={6} lg={4} key={feature.title}>
                <div className="lms-feature">
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </div>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      <footer className="lms-footer mt-auto py-4">
        <Container className="d-flex flex-wrap align-items-center gap-2">
          <span className="font-display fs-5 text-white me-auto">Luntian LMS</span>
          <span>Final project · Advanced Web Programming</span>
        </Container>
      </footer>
    </div>
  );
}

import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Logo from './Logo';

// Two-column shell shared by the log in and register pages.
export default function AuthLayout({ heading, text, children }) {
  return (
    <Row className="lms-auth g-0">
      <Col lg={5} className="lms-auth__panel d-none d-lg-flex flex-column p-5">
        <Logo light />
        <div className="mt-auto">
          <h1 className="font-display mb-3">{heading}</h1>
          <p className="fs-5 mb-0">{text}</p>
        </div>
      </Col>
      <Col lg={7} className="d-flex flex-column align-items-center justify-content-center p-4 p-md-5">
        <div className="d-lg-none mb-4 align-self-start">
          <Logo />
        </div>
        <div className="w-100" style={{ maxWidth: 460 }}>
          {children}
        </div>
      </Col>
    </Row>
  );
}

import { Link } from 'react-router-dom';
import { Button, Card, Col, Row, Table } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import LoadingSpinner from '../../components/LoadingSpinner';
import useFetch from '../../hooks/useFetch';
import { dashboardApi } from '../../api/services';
import { formatDate, fullName } from '../../utils/helpers';

export default function AdminDashboard() {
  const { data: response, loading, error, reload } = useFetch(() => dashboardApi.admin(), []);

  const dashboard = response?.data || {};
  const users = dashboard.users || {};
  const recentUsers = Array.isArray(dashboard.recentUsers) ? dashboard.recentUsers : [];
  const recentCertificates = Array.isArray(dashboard.recentCertificates) ? dashboard.recentCertificates : [];

  const retry = () => {
    reload();
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <EmptyState
        icon="bi-exclamation-triangle"
        title="Could not load dashboard"
        message={error}
        action={<Button onClick={retry}>Retry</Button>}
      />
    );
  }

  return (
    <>
      <PageHeader title="Admin Dashboard" icon="bi-grid-1x2" subtitle="Overview of the BPO Training Management System" />

      <Row className="g-3 mb-4">
        <Col xs={12} sm={6} xl={2}><StatCard label="Total Users" value={users.total ?? 0} icon="bi-people" tone="blue" /></Col>
        <Col xs={12} sm={6} xl={2}><StatCard label="Total Trainers" value={users.byRole?.trainer ?? 0} icon="bi-person-video3" tone="teal" /></Col>
        <Col xs={12} sm={6} xl={2}><StatCard label="Total Agents" value={users.byRole?.agent ?? 0} icon="bi-person-badge" tone="violet" /></Col>
        <Col xs={12} sm={6} xl={2}><StatCard label="Training Batches" value={dashboard.batches?.total ?? 0} icon="bi-collection" tone="amber" /></Col>
        <Col xs={12} sm={6} xl={2}><StatCard label="Issued Certificates" value={dashboard.certificatesIssued ?? 0} icon="bi-award" tone="green" /></Col>
        <Col xs={12} sm={6} xl={2}><StatCard label="Pending Endorsements" value={dashboard.pendingEndorsements ?? 0} icon="bi-hand-thumbs-up" tone="rose" /></Col>
      </Row>

      <Row className="g-4">
        <Col lg={7}>
          <Card className="h-100">
            <Card.Header className="bg-white border-0 pt-4 px-4">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div><h2 className="h6 fw-bold mb-1">Recent Users</h2><p className="text-muted small mb-0">Newest accounts added to the system</p></div>
                <Button as={Link} to="/admin/users" variant="outline-primary" size="sm">View users</Button>
              </div>
            </Card.Header>
            <Card.Body className="px-4">
              {recentUsers.length === 0 ? <EmptyState icon="bi-people" title="No users yet" message="Newly created accounts will appear here." /> : (
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead><tr><th>Name</th><th>Role</th><th>Status</th><th className="text-end">Created</th></tr></thead>
                    <tbody>{recentUsers.map((user) => (
                      <tr key={user._id}>
                        <td><div className="fw-semibold">{fullName(user)}</div><div className="small text-muted">{user.email || '-'}</div></td>
                        <td><StatusBadge status={user.role} /></td>
                        <td><StatusBadge status={user.isActive === false ? 'inactive' : 'active'} /></td>
                        <td className="text-end small text-nowrap">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="h-100">
            <Card.Header className="bg-white border-0 pt-4 px-4">
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div><h2 className="h6 fw-bold mb-1">Recent Certificates</h2><p className="text-muted small mb-0">Latest certificates issued to agents</p></div>
                <Button as={Link} to="/admin/certificates" variant="outline-primary" size="sm">View all</Button>
              </div>
            </Card.Header>
            <Card.Body className="px-4">
              {recentCertificates.length === 0 ? <EmptyState icon="bi-award" title="No certificates yet" message="Issued certificates will appear here." /> : (
                <div className="table-responsive">
                  <Table hover className="align-middle mb-0">
                    <thead><tr><th>Agent / Course</th><th>Certificate</th><th className="text-end">Issued</th></tr></thead>
                    <tbody>{recentCertificates.map((certificate) => (
                      <tr key={certificate._id}>
                        <td><div className="fw-semibold">{fullName(certificate.user)}</div><div className="small text-muted">{certificate.course?.code || '-'} · {certificate.course?.title || '-'}</div></td>
                        <td className="small text-nowrap">{certificate.code || '-'}</td>
                        <td className="text-end small text-nowrap">{formatDate(certificate.issuedAt)}</td>
                      </tr>
                    ))}</tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12}>
          <Card className="border-start border-4 border-warning">
            <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="stat-icon tone-amber"><i className="bi bi-hand-thumbs-up" /></div>
                <div><h2 className="h6 fw-bold mb-1">Pending Production Endorsements</h2><p className="text-muted small mb-0">Trainer-submitted endorsements awaiting administrative review.</p></div>
              </div>
              <Button as={Link} to="/admin/endorsements" variant="outline-primary">Review endorsements</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}

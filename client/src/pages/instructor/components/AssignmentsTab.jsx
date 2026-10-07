import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../../api/axios';
import ConfirmModal from '../../../components/ConfirmModal';
import LoadingBlock from '../../../components/LoadingBlock';
import { formatDateTime } from '../../../utils/format';
import AssignmentModal from './AssignmentModal';

export default function AssignmentsTab({ courseId }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState({ show: false, assignment: null });
  const [toDelete, setToDelete] = useState(null);

  const loadAssignments = useCallback(async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}/assignments`);
      setAssignments(data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const handleDelete = async () => {
    await api.delete(`/assignments/${toDelete.id}`);
    await loadAssignments();
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <p className="text-body-secondary mb-0 me-auto">
          Students upload a file for each assignment. Open one to download and grade them.
        </p>
        <Button onClick={() => setEditor({ show: true, assignment: null })}>
          <i className="bi bi-plus-lg me-2" aria-hidden="true" />
          New assignment
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {assignments.length === 0 ? (
        <div className="lms-card text-center p-5">
          <h2 className="fs-5 fw-bold">No assignments yet</h2>
          <p className="text-body-secondary mb-0">Create one to start collecting submissions.</p>
        </div>
      ) : (
        <div className="lms-card">
          <Table responsive className="lms-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Due</th>
                <th>Points</th>
                <th>Submitted</th>
                <th>To grade</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td style={{ minWidth: 220 }}>
                    <Link
                      to={`/instructor/assignments/${assignment.id}`}
                      className="fw-bold text-reset text-decoration-none"
                    >
                      {assignment.title}
                    </Link>
                  </td>
                  <td className="text-nowrap text-body-secondary">
                    {assignment.dueDate ? formatDateTime(assignment.dueDate) : 'No due date'}
                  </td>
                  <td>{assignment.points}</td>
                  <td>{assignment.submittedCount}</td>
                  <td>
                    {assignment.ungradedCount > 0 ? (
                      <span className="lms-pill lms-pill--amber">{assignment.ungradedCount}</span>
                    ) : (
                      <span className="text-body-secondary">0</span>
                    )}
                  </td>
                  <td className="text-end text-nowrap">
                    <Link
                      to={`/instructor/assignments/${assignment.id}`}
                      className="lms-icon-action"
                      aria-label={`Grade ${assignment.title}`}
                      title="Submissions"
                    >
                      <i className="bi bi-inboxes" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="lms-icon-action"
                      aria-label={`Edit ${assignment.title}`}
                      title="Edit"
                      onClick={() => setEditor({ show: true, assignment })}
                    >
                      <i className="bi bi-pencil-square" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="lms-icon-action lms-icon-action--danger"
                      aria-label={`Delete ${assignment.title}`}
                      title="Delete"
                      onClick={() => setToDelete(assignment)}
                    >
                      <i className="bi bi-trash3" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <AssignmentModal
        show={editor.show}
        courseId={courseId}
        assignment={editor.assignment}
        onHide={() => setEditor({ show: false, assignment: null })}
        onSaved={loadAssignments}
      />

      <ConfirmModal
        show={Boolean(toDelete)}
        title="Delete this assignment?"
        confirmLabel="Delete assignment"
        onConfirm={handleDelete}
        onHide={() => setToDelete(null)}
      >
        <p className="mb-0">
          <strong>{toDelete?.title}</strong> and every file students submitted for it will be
          removed. This cannot be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

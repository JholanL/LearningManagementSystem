import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Table from 'react-bootstrap/Table';
import api, { getErrorMessage } from '../../../api/axios';
import ConfirmModal from '../../../components/ConfirmModal';
import LoadingBlock from '../../../components/LoadingBlock';
import { formatDate } from '../../../utils/format';

export default function StudentsTab({ courseId, onCountChange }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toRemove, setToRemove] = useState(null);

  const loadStudents = useCallback(async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}/students`);
      setStudents(data.data);
      setError('');
      onCountChange?.(data.data.length);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId, onCountChange]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleRemove = async () => {
    await api.delete(`/courses/${courseId}/students/${toRemove.id}`);
    await loadStudents();
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      {error && <Alert variant="danger">{error}</Alert>}

      {students.length === 0 ? (
        <div className="lms-card text-center p-5">
          <h2 className="fs-5 fw-bold">No students yet</h2>
          <p className="text-body-secondary mb-0">
            Share the enroll code above. Students who join will show up here.
          </p>
        </div>
      ) : (
        <div className="lms-card">
          <Table responsive className="lms-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Joined</th>
                <th style={{ minWidth: 180 }}>Lesson progress</th>
                <th className="text-end">Remove</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td style={{ minWidth: 220 }}>
                    <div className="fw-semibold">{student.name}</div>
                    <div className="small text-body-secondary">{student.email}</div>
                  </td>
                  <td className="text-nowrap text-body-secondary">{formatDate(student.enrolledAt)}</td>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <div className="lms-progress lms-progress--on-white flex-grow-1">
                        <div style={{ width: `${student.progress.percent}%` }} />
                      </div>
                      <span className="small fw-semibold" style={{ width: 40 }}>
                        {student.progress.percent}%
                      </span>
                    </div>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="lms-icon-action lms-icon-action--danger"
                      aria-label={`Remove ${student.name}`}
                      title="Remove from course"
                      onClick={() => setToRemove(student)}
                    >
                      <i className="bi bi-person-dash" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <ConfirmModal
        show={Boolean(toRemove)}
        title="Remove this student?"
        confirmLabel="Remove student"
        onConfirm={handleRemove}
        onHide={() => setToRemove(null)}
      >
        <p className="mb-0">
          <strong>{toRemove?.name}</strong> loses access to this course. They can join again with
          the enroll code unless you replace it.
        </p>
      </ConfirmModal>
    </>
  );
}

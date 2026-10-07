import { useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../../api/axios';
import LoadingBlock from '../../../components/LoadingBlock';
import { saveTextFile } from '../../../utils/downloadFile';

const csvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const isPastDue = (assignment) => assignment.dueDate && new Date(assignment.dueDate) < new Date();

function GradeCell({ entry, assignment }) {
  if (!entry) {
    return isPastDue(assignment) ? (
      <span className="lms-pill lms-pill--danger">Missing</span>
    ) : (
      <span className="text-body-secondary">—</span>
    );
  }
  if (entry.grade === null) {
    return <span className="lms-pill lms-pill--amber">To grade</span>;
  }
  return (
    <>
      <span className="fw-semibold">{entry.grade}</span>
      {entry.late && <div className="small text-body-secondary">Late</div>}
    </>
  );
}

export default function GradebookTab({ courseId, courseTitle }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    api
      .get(`/courses/${courseId}/gradebook`)
      .then(({ data: result }) => {
        if (!ignore) setData(result);
      })
      .catch((err) => {
        if (!ignore) setError(getErrorMessage(err));
      });
    return () => {
      ignore = true;
    };
  }, [courseId]);

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!data) return <LoadingBlock />;

  const { assignments, students } = data;

  if (assignments.length === 0 || students.length === 0) {
    return (
      <div className="lms-card text-center p-5">
        <h2 className="fs-5 fw-bold">Nothing to show yet</h2>
        <p className="text-body-secondary mb-0">
          The gradebook fills in once the course has students and at least one assignment.
        </p>
      </div>
    );
  }

  // Class average per assignment, counting graded work only.
  const averages = assignments.map((assignment) => {
    const grades = students
      .map((student) => student.grades[assignment.id])
      .filter((entry) => entry && entry.grade !== null)
      .map((entry) => entry.grade);
    return grades.length
      ? Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 10) / 10
      : null;
  });

  const exportCsv = () => {
    const header = [
      'Student',
      'Email',
      ...assignments.map((assignment) => `${assignment.title} (${assignment.points})`),
      'Points earned',
      'Points possible',
      'Percent',
    ];
    const rows = students.map((student) => [
      student.name,
      student.email,
      ...assignments.map((assignment) => {
        const entry = student.grades[assignment.id];
        if (!entry) return isPastDue(assignment) ? 'Missing' : '';
        return entry.grade === null ? 'To grade' : entry.grade;
      }),
      student.earned,
      student.possible,
      student.percent === null ? '' : `${student.percent}%`,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    saveTextFile(`﻿${csv}`, `${courseTitle} gradebook.csv`);
  };

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <p className="text-body-secondary mb-0 me-auto">
          The percent counts graded work only. Open an assignment to grade it.
        </p>
        <Button variant="outline-primary" onClick={exportCsv}>
          <i className="bi bi-filetype-csv me-2" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="lms-card">
        <Table responsive className="lms-table lms-gradebook">
          <thead>
            <tr>
              <th style={{ minWidth: 200 }}>Student</th>
              {assignments.map((assignment) => (
                <th key={assignment.id} className="text-center" style={{ minWidth: 120 }}>
                  <Link
                    to={`/instructor/assignments/${assignment.id}`}
                    className="text-reset"
                    title={assignment.title}
                  >
                    {assignment.title.length > 18
                      ? `${assignment.title.slice(0, 18)}…`
                      : assignment.title}
                  </Link>
                  <div className="fw-normal text-lowercase">/ {assignment.points}</div>
                </th>
              ))}
              <th className="text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <div className="fw-semibold">{student.name}</div>
                  <div className="small text-body-secondary">{student.email}</div>
                </td>
                {assignments.map((assignment) => (
                  <td key={assignment.id} className="lms-gradebook__cell">
                    <GradeCell entry={student.grades[assignment.id]} assignment={assignment} />
                  </td>
                ))}
                <td className="lms-gradebook__cell">
                  {student.percent === null ? (
                    <span className="text-body-secondary">—</span>
                  ) : (
                    <>
                      <span className="fw-bold">{student.percent}%</span>
                      <div className="small text-body-secondary">
                        {student.earned} / {student.possible}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Class average</td>
              {averages.map((average, index) => (
                <td key={assignments[index].id} className="lms-gradebook__cell">
                  {average === null ? '—' : average}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </Table>
      </div>
    </>
  );
}

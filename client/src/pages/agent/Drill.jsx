/**
 * Agent → Daily Drill (/agent/drill): 5 quick practice questions.
 * One question per screen with progress dots, then a review with explanations.
 * Practice only — it does not affect quiz attempts, progress or certificates.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Form } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../context/ToastContext';
import { drillApi } from '../../api/services';
import { getErrorMessage } from '../../utils/helpers';

export default function Drill() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null); // today payload
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null); // submit result (or completed review)
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    drillApi
      .today()
      .then((res) => {
        if (ignore) return;
        setData(res.data);
        setAnswers(Array(res.data.questions.length).fill(-1));
        if (res.data.completed) setResult({ score: res.data.score, total: res.data.total, review: res.data.review, streak: res.data.streak });
      })
      .catch((err) => !ignore && toast.error(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => { ignore = true; };
  }, [toast]);

  const choose = (optionIndex) => setAnswers((a) => a.map((v, i) => (i === idx ? optionIndex : v)));

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await drillApi.submit(answers);
      setResult(res.data);
      if ([3, 7, 14].includes(res.data.streak)) toast.success(`${res.data.streak}-day streak! 🔥`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (data?.empty) {
    return (
      <>
        <PageHeader title="Daily Drill" icon="bi-lightning-charge" />
        <EmptyState icon="bi-journal-x" title="No drill available yet" message="You'll get daily practice questions once your trainer assigns you courses." action={<Button as={Link} to="/agent">Back to dashboard</Button>} />
      </>
    );
  }

  // Review screen (just submitted, or already done today)
  if (result) {
    return (
      <>
        <PageHeader title="Daily Drill" icon="bi-lightning-charge" subtitle={`Score ${result.score}/${result.total} · ${result.streak}-day streak`} actions={<Button variant="light" as={Link} to="/agent">Done</Button>} />
        <Card>
          <Card.Body>
            {result.review.map((r, i) => (
              <div key={i} className="mb-4 pb-3 border-bottom">
                <div className="fw-semibold mb-2">
                  <span className={`badge-tone me-2 ${r.correct ? 'badge-green' : 'badge-red'}`}>{r.correct ? 'Correct' : 'Wrong'}</span>
                  {i + 1}. {r.question}
                </div>
                {r.options.map((opt, oi) => (
                  <div key={oi} className={`drill-opt ${oi === r.correctAnswer ? 'is-correct' : oi === r.selected ? 'is-wrong' : ''}`}>
                    {oi === r.correctAnswer && <i className="bi bi-check-circle-fill text-success me-1" />}
                    {oi === r.selected && oi !== r.correctAnswer && <i className="bi bi-x-circle-fill text-danger me-1" />}
                    {opt}
                  </div>
                ))}
                {r.explanation && <div className="small text-muted mt-2"><i className="bi bi-info-circle me-1" />{r.explanation}</div>}
              </div>
            ))}
            <Button as={Link} to="/agent">Back to dashboard</Button>
          </Card.Body>
        </Card>
      </>
    );
  }

  // Playing: one question per screen
  const q = data.questions[idx];
  const isLast = idx === data.questions.length - 1;
  const allAnswered = answers.every((a) => a >= 0);

  return (
    <>
      <PageHeader title="Daily Drill" icon="bi-lightning-charge" subtitle={`Question ${idx + 1} of ${data.questions.length} · ${data.streak}-day streak`} />

      <div className="drill-dots mb-3">
        {data.questions.map((_, i) => (
          <span key={i} className={`drill-dot ${answers[i] >= 0 ? 'answered' : ''} ${i === idx ? 'current' : ''}`} />
        ))}
      </div>

      <Card>
        <Card.Body>
          <div className="small text-muted mb-1">{q.quizTitle}</div>
          <h2 className="h5 mb-3">{q.question}</h2>
          <div className="d-grid gap-2">
            {q.options.map((opt, oi) => (
              <Form.Check
                key={oi}
                type="radio"
                name={`q-${idx}`}
                id={`q-${idx}-o-${oi}`}
                label={opt}
                checked={answers[idx] === oi}
                onChange={() => choose(oi)}
                className="drill-choice"
              />
            ))}
          </div>

          <div className="d-flex justify-content-between mt-4">
            <Button variant="light" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              <i className="bi bi-arrow-left me-1" /> Back
            </Button>
            {isLast ? (
              <Button onClick={submit} disabled={!allAnswered || submitting}>
                {submitting ? 'Submitting...' : 'Submit drill'}
              </Button>
            ) : (
              <Button onClick={() => setIdx((i) => i + 1)} disabled={answers[idx] < 0}>
                Next <i className="bi bi-arrow-right ms-1" />
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </>
  );
}

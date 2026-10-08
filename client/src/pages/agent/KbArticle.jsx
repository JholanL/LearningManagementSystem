/**
 * Agent → single Knowledge Base article (/agent/kb/:slug).
 * Shows the body (text + line breaks only), related courses, and "Was this helpful?".
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card } from 'react-bootstrap';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ArticleBody from '../../components/ArticleBody';
import { useToast } from '../../context/ToastContext';
import { kbApi } from '../../api/services';
import { getErrorMessage, formatDate } from '../../utils/helpers';

export default function KbArticle() {
  const { slug } = useParams();
  const toast = useToast();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    kbApi
      .get(slug)
      .then((res) => !ignore && setArticle(res.data))
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [slug]);

  const vote = async (helpful) => {
    setVoting(true);
    try {
      const res = await kbApi.feedback(article._id, helpful);
      setArticle((a) => ({ ...a, ...res.data })); // { helpfulYes, helpfulNo, myVote }
      toast.success('Thanks for the feedback.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setVoting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <EmptyState
        icon="bi-journal-x"
        title="Article not available"
        message={error}
        action={<Button as={Link} to="/agent/kb">Back to Knowledge Base</Button>}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={article.title}
        icon="bi-journal-text"
        subtitle={`${article.category}${article.account ? ` · ${article.account}` : ''} · updated ${formatDate(article.updatedAt)}`}
        actions={<Button variant="light" as={Link} to="/agent/kb"><i className="bi bi-arrow-left me-1" /> Back</Button>}
      />

      <Card className="mb-3">
        <Card.Body>
          {article.summary && <p className="text-muted">{article.summary}</p>}
          {article.tags?.length > 0 && (
            <div className="d-flex flex-wrap gap-1 mb-3">
              {article.tags.map((t) => <span key={t} className="kb-tag">#{t}</span>)}
            </div>
          )}
          <ArticleBody text={article.body} />
        </Card.Body>
      </Card>

      {article.relatedCourses?.length > 0 && (
        <Card className="mb-3">
          <Card.Header>Related courses</Card.Header>
          <Card.Body className="d-flex flex-wrap gap-2">
            {article.relatedCourses.map((c) => (
              <Button key={c._id} size="sm" variant="outline-secondary" as={Link} to={`/agent/courses/${c._id}`}>
                <i className="bi bi-journal-bookmark me-1" />{c.code} · {c.title}
              </Button>
            ))}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body className="d-flex flex-wrap align-items-center gap-3">
          <span className="fw-semibold">Was this helpful?</span>
          <div className="d-flex gap-2">
            <Button variant={article.myVote === true ? 'primary' : 'outline-secondary'} size="sm" disabled={voting} onClick={() => vote(true)}>
              <i className="bi bi-hand-thumbs-up me-1" /> Yes <span className="text-muted">({article.helpfulYes})</span>
            </Button>
            <Button variant={article.myVote === false ? 'primary' : 'outline-secondary'} size="sm" disabled={voting} onClick={() => vote(false)}>
              <i className="bi bi-hand-thumbs-down me-1" /> No <span className="text-muted">({article.helpfulNo})</span>
            </Button>
          </div>
        </Card.Body>
      </Card>
    </>
  );
}

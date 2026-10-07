import { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import api, { getErrorMessage } from '../../../api/axios';
import ConfirmModal from '../../../components/ConfirmModal';
import LoadingBlock from '../../../components/LoadingBlock';
import { formatDateTime } from '../../../utils/format';

const LIMITS = { title: 150, body: 5000 };

function AnnouncementModal({ show, courseId, announcement, onHide, onSaved }) {
  const [values, setValues] = useState({ title: '', body: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setErrors({});
    setServerError('');
    setValues(
      announcement ? { title: announcement.title, body: announcement.body } : { title: '', body: '' }
    );
  }, [show, announcement]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');

    const found = {};
    if (!values.title.trim()) found.title = 'Enter a title';
    else if (values.title.trim().length > LIMITS.title)
      found.title = `Title must be at most ${LIMITS.title} characters`;
    if (!values.body.trim()) found.body = 'Write the announcement';
    else if (values.body.trim().length > LIMITS.body)
      found.body = `Message must be at most ${LIMITS.body} characters`;
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = { title: values.title.trim(), body: values.body.trim() };
    setSaving(true);
    try {
      if (announcement) {
        await api.put(`/announcements/${announcement.id}`, payload);
      } else {
        await api.post(`/courses/${courseId}/announcements`, payload);
      }
      onSaved();
      onHide();
    } catch (err) {
      setServerError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={saving ? undefined : onHide} size="lg" centered>
      <Form noValidate onSubmit={handleSubmit}>
        <Modal.Header closeButton={!saving}>
          <Modal.Title className="fs-5 fw-bold">
            {announcement ? 'Edit announcement' : 'New announcement'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {serverError && <Alert variant="danger">{serverError}</Alert>}
          <Form.Group className="mb-3" controlId="announcement-title">
            <Form.Label>Title</Form.Label>
            <Form.Control
              name="title"
              value={values.title}
              onChange={handleChange}
              isInvalid={Boolean(errors.title)}
              placeholder="e.g. No class on Thursday"
            />
            <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="announcement-body">
            <Form.Label>Message</Form.Label>
            <Form.Control
              as="textarea"
              rows={6}
              name="body"
              value={values.body}
              onChange={handleChange}
              isInvalid={Boolean(errors.body)}
            />
            <Form.Control.Feedback type="invalid">{errors.body}</Form.Control.Feedback>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-primary" onClick={onHide} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : announcement ? 'Save changes' : 'Post announcement'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function AnnouncementsTab({ courseId }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState({ show: false, announcement: null });
  const [toDelete, setToDelete] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data } = await api.get(`/courses/${courseId}/announcements`);
      setAnnouncements(data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleDelete = async () => {
    await api.delete(`/announcements/${toDelete.id}`);
    await loadAnnouncements();
  };

  if (loading) return <LoadingBlock />;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <p className="text-body-secondary mb-0 me-auto">
          Enrolled students see these on the course page and on their dashboard.
        </p>
        <Button onClick={() => setEditor({ show: true, announcement: null })}>
          <i className="bi bi-megaphone me-2" aria-hidden="true" />
          New announcement
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {announcements.length === 0 ? (
        <div className="lms-card text-center p-5">
          <h2 className="fs-5 fw-bold">No announcements yet</h2>
          <p className="text-body-secondary mb-0">Post updates, reminders, or schedule changes.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {announcements.map((item) => {
            const edited = new Date(item.updatedAt) - new Date(item.createdAt) > 1000;
            return (
              <article key={item.id} className="lms-card p-3 p-md-4">
                <div className="d-flex align-items-start gap-2">
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <h2 className="fs-5 fw-bold mb-1">{item.title}</h2>
                    <div className="small text-body-secondary mb-2">
                      {item.author?.name} · {formatDateTime(item.createdAt)}
                      {edited && ' · Edited'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="lms-icon-action"
                    aria-label={`Edit ${item.title}`}
                    title="Edit"
                    onClick={() => setEditor({ show: true, announcement: item })}
                  >
                    <i className="bi bi-pencil-square" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="lms-icon-action lms-icon-action--danger"
                    aria-label={`Delete ${item.title}`}
                    title="Delete"
                    onClick={() => setToDelete(item)}
                  >
                    <i className="bi bi-trash3" aria-hidden="true" />
                  </button>
                </div>
                <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <AnnouncementModal
        show={editor.show}
        courseId={courseId}
        announcement={editor.announcement}
        onHide={() => setEditor({ show: false, announcement: null })}
        onSaved={loadAnnouncements}
      />

      <ConfirmModal
        show={Boolean(toDelete)}
        title="Delete this announcement?"
        confirmLabel="Delete announcement"
        onConfirm={handleDelete}
        onHide={() => setToDelete(null)}
      >
        <p className="mb-0">
          <strong>{toDelete?.title}</strong> will be removed for every student.
        </p>
      </ConfirmModal>
    </>
  );
}

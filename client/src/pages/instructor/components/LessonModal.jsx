import { useEffect, useRef, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import api, { getErrorMessage } from '../../../api/axios';
import LoadingBlock from '../../../components/LoadingBlock';
import {
  checkUploadFile,
  isHttpUrl,
  LESSON_LIMITS,
  MAX_UPLOAD_MB,
  UPLOAD_EXTENSIONS,
} from '../../../constants/courses';
import { downloadLessonFile } from '../../../utils/downloadFile';
import { formatFileSize } from '../../../utils/format';

const EMPTY = { title: '', videoUrl: '', content: '' };
const MAX_FILES = 5;

const validate = ({ title, videoUrl, content }) => {
  const errors = {};
  if (!title.trim()) errors.title = 'Enter a lesson title';
  else if (title.trim().length > LESSON_LIMITS.title)
    errors.title = `Title must be at most ${LESSON_LIMITS.title} characters`;
  if (videoUrl.trim() && !isHttpUrl(videoUrl.trim()))
    errors.videoUrl = 'Enter a full link that starts with http:// or https://';
  if (content.trim().length > LESSON_LIMITS.content)
    errors.content = `Content must be at most ${LESSON_LIMITS.content} characters`;
  return errors;
};

// Files shared with a saved lesson. Uploads and deletes happen right away.
function LessonFiles({ lessonId, files, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const problem = checkUploadFile(file);
    if (problem) {
      setError(problem);
      return;
    }

    const form = new FormData();
    form.append('file', file);

    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/lessons/${lessonId}/attachments`, form);
      onChange(data.lesson.attachments);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (file) => {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.delete(`/lessons/${lessonId}/attachments/${file.id}`);
      onChange(data.lesson.attachments);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (file) => {
    setError('');
    try {
      await downloadLessonFile(lessonId, file);
    } catch {
      setError('Could not download the file.');
    }
  };

  return (
    <div className="mt-4 pt-3 border-top">
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="fw-semibold me-auto">
          Files <span className="text-body-secondary fw-normal">({files.length} of {MAX_FILES})</span>
        </div>
        <Button
          variant="outline-primary"
          size="sm"
          disabled={busy || files.length >= MAX_FILES}
          onClick={() => inputRef.current.click()}
        >
          <i className="bi bi-paperclip me-1" aria-hidden="true" />
          {busy ? 'Working…' : 'Attach file'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="d-none"
          accept={UPLOAD_EXTENSIONS.join(',')}
          onChange={handleUpload}
          aria-label="Attach a file to this lesson"
        />
      </div>

      {error && <Alert variant="danger" className="py-2">{error}</Alert>}

      {files.length === 0 ? (
        <p className="small text-body-secondary mb-0">
          Share slides or handouts. Up to {MAX_UPLOAD_MB} MB each.
        </p>
      ) : (
        files.map((file) => (
          <div key={file.id} className="d-flex align-items-center gap-2 py-1">
            <i className="bi bi-file-earmark" aria-hidden="true" />
            <button
              type="button"
              className="btn btn-link p-0 text-truncate text-start"
              onClick={() => handleDownload(file)}
            >
              {file.name}
            </button>
            <span className="small text-body-secondary me-auto">{formatFileSize(file.size)}</span>
            <button
              type="button"
              className="lms-icon-action lms-icon-action--danger"
              aria-label={`Remove ${file.name}`}
              disabled={busy}
              onClick={() => handleDelete(file)}
            >
              <i className="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// Adds a lesson, or edits one when `lessonId` is given. After a new lesson is
// saved the modal stays open on it so files can be attached right away.
export default function LessonModal({ show, courseId, lessonId, onHide, onSaved }) {
  const [currentId, setCurrentId] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // The lesson list leaves out the content, so load the full lesson to edit it.
  useEffect(() => {
    if (!show) return;
    setCurrentId(lessonId || null);
    setErrors({});
    setServerError('');
    setNotice('');

    if (!lessonId) {
      setValues(EMPTY);
      setFiles([]);
      return;
    }

    let ignore = false;
    setLoading(true);
    api
      .get(`/lessons/${lessonId}`)
      .then(({ data }) => {
        if (ignore) return;
        const { title, videoUrl, content, attachments } = data.lesson;
        setValues({ title, videoUrl: videoUrl || '', content: content || '' });
        setFiles(attachments);
      })
      .catch((err) => {
        if (!ignore) setServerError(getErrorMessage(err));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [show, lessonId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleFilesChange = (attachments) => {
    setFiles(attachments);
    onSaved();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    setNotice('');

    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = {
      title: values.title.trim(),
      videoUrl: values.videoUrl.trim(),
      content: values.content.trim(),
    };

    setSaving(true);
    try {
      if (currentId) {
        await api.put(`/lessons/${currentId}`, payload);
        onSaved();
        onHide();
      } else {
        const { data } = await api.post(`/courses/${courseId}/lessons`, payload);
        setCurrentId(data.lesson.id);
        setFiles([]);
        setNotice('Lesson added. You can attach files below, or close this window.');
        onSaved();
      }
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
          <Modal.Title className="fs-5 fw-bold">{currentId ? 'Edit lesson' : 'Add lesson'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {serverError && <Alert variant="danger">{serverError}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              <Form.Group className="mb-3" controlId="lesson-title">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  name="title"
                  value={values.title}
                  onChange={handleChange}
                  isInvalid={Boolean(errors.title)}
                />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-3" controlId="lesson-video">
                <Form.Label>Video link (optional)</Form.Label>
                <Form.Control
                  type="url"
                  name="videoUrl"
                  value={values.videoUrl}
                  onChange={handleChange}
                  isInvalid={Boolean(errors.videoUrl)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
                <Form.Control.Feedback type="invalid">{errors.videoUrl}</Form.Control.Feedback>
              </Form.Group>

              <Form.Group controlId="lesson-content">
                <Form.Label>Lesson content</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={8}
                  name="content"
                  value={values.content}
                  onChange={handleChange}
                  isInvalid={Boolean(errors.content)}
                />
                <Form.Control.Feedback type="invalid">{errors.content}</Form.Control.Feedback>
              </Form.Group>

              {currentId ? (
                <LessonFiles lessonId={currentId} files={files} onChange={handleFilesChange} />
              ) : (
                <p className="small text-body-secondary mt-3 mb-0">
                  You can attach files after the lesson is added.
                </p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-primary" onClick={onHide} disabled={saving}>
            {notice ? 'Done' : 'Cancel'}
          </Button>
          <Button type="submit" disabled={saving || loading}>
            {saving ? 'Saving…' : currentId ? 'Save lesson' : 'Add lesson'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

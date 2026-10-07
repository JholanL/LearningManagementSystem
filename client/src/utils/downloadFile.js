import api from '../api/axios';

// Uploaded files need the login token, so they are fetched with Axios and
// saved through a temporary link instead of opening the URL directly.
export const downloadFromApi = async (url, filename) => {
  const response = await api.get(url, { responseType: 'blob' });

  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

export const downloadSubmissionFile = (submission) =>
  downloadFromApi(`/submissions/${submission.id}/file`, submission.file.name);

export const downloadLessonFile = (lessonId, file) =>
  downloadFromApi(`/lessons/${lessonId}/attachments/${file.id}`, file.name);

// Saves text the browser built (e.g. a CSV export) as a file.
export const saveTextFile = (text, filename, type = 'text/csv') => {
  const objectUrl = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

// Same limits the API checks. Keep both sides in sync.
export const COURSE_LIMITS = { title: 150, description: 2000, code: 20 };
export const LESSON_LIMITS = { title: 150, content: 20000, videoUrl: 500 };
export const ASSIGNMENT_LIMITS = { title: 150, instructions: 5000, maxPoints: 1000 };

export const COURSE_CATEGORIES = [
  'Web development',
  'Programming',
  'Databases',
  'Networking',
  'Design',
  'General education',
];

export const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Same rules as server/middleware/upload.js.
export const MAX_UPLOAD_MB = 10;
export const UPLOAD_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
];

// Returns an error message for a file the server would reject, or '' if it is fine.
export const checkUploadFile = (file) => {
  if (!file) return 'Choose a file first';
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!UPLOAD_EXTENSIONS.includes(extension)) {
    return `This file type is not allowed. Use ${UPLOAD_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `File must be ${MAX_UPLOAD_MB} MB or smaller`;
  }
  return '';
};

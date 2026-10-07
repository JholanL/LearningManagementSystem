const crypto = require('crypto');
const path = require('path');
const multer = require('multer');
const { UPLOAD_DIR } = require('../utils/uploads');

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_EXTENSIONS = [
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

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Random name on disk so uploads can't overwrite each other or pick their own path.
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    const err = new Error(`File type not allowed. Use one of: ${ALLOWED_EXTENSIONS.join(', ')}`);
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
});

// Accepts one file in the "file" field and turns multer errors into 400 responses.
exports.uploadSingleFile = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `File must be ${MAX_FILE_SIZE_MB} MB or smaller`
          : 'Upload one file in the "file" field';
      return res.status(400).json({ message });
    }
    next(err);
  });
};

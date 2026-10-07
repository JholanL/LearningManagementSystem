const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const getUploadPath = (storedName) => path.join(UPLOAD_DIR, path.basename(storedName));

// Deleting a file that is already gone is not an error.
const removeFile = async (storedName) => {
  if (!storedName) return;
  try {
    await fs.promises.unlink(getUploadPath(storedName));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Could not delete upload:', err.message);
  }
};

module.exports = { UPLOAD_DIR, getUploadPath, removeFile };

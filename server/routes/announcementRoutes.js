const express = require('express');
const {
  getFeed,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const managers = authorize('instructor', 'admin');

router.use(protect);

router.get('/feed', authorize('student'), getFeed);
router.put('/:id', managers, updateAnnouncement);
router.delete('/:id', managers, deleteAnnouncement);

module.exports = router;

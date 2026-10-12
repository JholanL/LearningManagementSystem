const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const { searchAdminRecords } = require('../controllers/adminSearchController');

const router = express.Router();

router.get('/', protect, authorize('admin'), searchAdminRecords);

module.exports = router;

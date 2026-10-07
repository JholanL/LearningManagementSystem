// Smaller route groups: progress, certificates, dashboards, leaderboard, meta
const router = require('express').Router();
const progress = require('../controllers/progressController');
const certificates = require('../controllers/certificateController');
const dashboard = require('../controllers/dashboardController');
const leaderboard = require('../controllers/leaderboardController');
const validate = require('../middleware/validate');
const { mongoIdParam } = require('../validators/common');
const { protect, authorize } = require('../middleware/auth');
const { ROLES } = require('../models/User');
const { CATEGORIES, LEVELS } = require('../models/Course');
const { CRITERIA } = require('../models/Evaluation');

// ---- Public ----
router.get('/certificates/verify/:code', certificates.verifyCertificate);
router.get('/meta', (_req, res) =>
  res.json({
    success: true,
    data: {
      roles: ROLES,
      courseCategories: CATEGORIES,
      courseLevels: LEVELS,
      batchStatuses: ['upcoming', 'ongoing', 'completed'],
      scenarioCategories: ['Billing', 'Technical', 'Sales', 'Complaint', 'Account'],
      scenarioDifficulties: ['Easy', 'Medium', 'Hard'],
      customerMoods: ['calm', 'confused', 'frustrated', 'irate'],
      callTypes: ['Inbound', 'Outbound', 'Chat', 'Email'],
      evaluationCriteria: CRITERIA,
    },
  })
);

// ---- Protected ----
router.get('/progress/me', protect, authorize('agent'), progress.getMyProgress);
router.get('/progress/batch/:batchId', protect, authorize('admin', 'trainer'), mongoIdParam('batchId'), validate, progress.getBatchProgress);

router.get('/certificates/me', protect, authorize('agent'), certificates.getMyCertificates);
router.get('/certificates', protect, authorize('admin', 'trainer'), certificates.getCertificates);

router.get('/dashboard/admin', protect, authorize('admin'), dashboard.adminDashboard);
router.get('/dashboard/trainer', protect, authorize('trainer'), dashboard.trainerDashboard);
router.get('/dashboard/agent', protect, authorize('agent'), dashboard.agentDashboard);

router.get('/leaderboard', protect, leaderboard.getLeaderboard);

module.exports = router;

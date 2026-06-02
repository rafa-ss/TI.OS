const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/schools', require('./school.routes'));
router.use('/stock', require('./stockItem.routes'));
router.use('/equipment', require('./equipment.routes'));
router.use('/laboratories', require('./laboratory.routes'));
router.use('/orders', require('./serviceOrder.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/reports', require('./report.routes'));
router.use('/chat', require('./chat.routes'));
router.use('/staff-reports', require('./staffReport.routes'));
router.use('/notifications', require('./notification.routes'));

router.get('/health', (_req, res) =>
  res.json({ success: true, service: 'os-abaetetuba-api', time: new Date().toISOString() })
);

module.exports = router;

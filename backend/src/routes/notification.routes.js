const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/notification.controller');

router.use(authenticate);
router.get('/', ctrl.list);
router.patch('/:id/read', ctrl.markRead);
router.patch('/read-all', ctrl.markAllRead);

module.exports = router;

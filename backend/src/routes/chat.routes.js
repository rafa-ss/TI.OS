const router = require('express').Router();
const ctrl = require('../controllers/chat.controller');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/contacts', ctrl.contacts);
router.get('/conversations', ctrl.conversations);
router.get('/messages', ctrl.list);
router.post('/messages', ctrl.send);
router.post('/read', ctrl.markRead);
router.get('/unread', ctrl.unread);
router.post('/presence', ctrl.presence);

module.exports = router;

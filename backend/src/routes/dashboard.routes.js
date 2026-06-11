const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/dashboard.controller');

router.use(authenticate);
router.get('/summary', ctrl.summary);
router.get('/noc', ctrl.noc);

module.exports = router;

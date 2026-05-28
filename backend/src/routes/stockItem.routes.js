const router = require('express').Router();
const ctrl = require('../controllers/stockItem.controller');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.post('/', authorize('admin', 'tecnico'), ctrl.create);
router.put('/:id', authorize('admin', 'tecnico'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;
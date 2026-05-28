const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const { createUserSchema, updateUserSchema } = require('../validations/user.validation');

router.use(authenticate);

router.get('/', authorize('admin'), ctrl.list);
router.get('/:id', authorize('admin'), ctrl.get);
router.post('/', authorize('admin'), validate({ body: createUserSchema }), ctrl.create);
router.put('/:id', authorize('admin'), validate({ body: updateUserSchema }), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;

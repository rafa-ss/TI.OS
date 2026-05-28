const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const { loginSchema } = require('../validations/auth.validation');
const { authenticate } = require('../middlewares/auth');

router.post('/login', validate({ body: loginSchema }), ctrl.login);
router.get('/me', authenticate, ctrl.me);

module.exports = router;

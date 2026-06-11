const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const validate = require('../middlewares/validate');
const { authenticate, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { createUserSchema, updateUserSchema } = require('../validations/user.validation');

router.use(authenticate);

// === Próprio perfil (qualquer usuário logado) ===
router.put('/me/profile', ctrl.updateMyProfile);
router.post('/me/avatar', upload.single('file'), ctrl.uploadMyAvatar);
router.delete('/me/avatar', ctrl.removeMyAvatar);
router.put('/me/password', ctrl.changeMyPassword);

// === Lista enxuta da equipe (admin + técnico) — para seleção em formulários ===
router.get('/staff', authorize('admin', 'tecnico'), ctrl.staff);

// === Gestão de usuários (admin) ===
router.get('/', authorize('admin'), ctrl.list);
router.get('/:id', authorize('admin'), ctrl.get);
router.post('/', authorize('admin'), validate({ body: createUserSchema }), ctrl.create);
router.put('/:id', authorize('admin'), validate({ body: updateUserSchema }), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;

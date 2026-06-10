const router = require('express').Router();
const ctrl = require('../controllers/kit.controller');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

// Qualquer usuário autenticado pode listar/ver kits (para montar laboratório)
router.get('/', ctrl.list);
router.get('/:id', ctrl.get);

// CRUD restrito a administradores
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/school.controller');
const { authenticate, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/options', ctrl.options);
router.get('/:id', ctrl.get);

// Cadastro / edição / exclusão manual — restrito a admin
router.post('/', authorize('admin'), ctrl.create);
router.put('/:id', authorize('admin'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

// Importação Censo Escolar
router.post('/import/censo', authorize('admin'), upload.single('file'), ctrl.importCenso);

module.exports = router;

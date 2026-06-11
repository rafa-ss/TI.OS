const router = require('express').Router();
const ctrl = require('../controllers/laboratory.controller');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);
router.get('/:id', ctrl.get);
router.post('/', authorize('admin', 'tecnico'), ctrl.create);
router.put('/:id', authorize('admin', 'tecnico'), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);
router.post('/:id/deactivate', authorize('admin', 'tecnico'), ctrl.deactivate);
router.post('/:id/inspect', authorize('admin', 'tecnico'), ctrl.inspect);

// Estações de trabalho (mapa visual)
router.get('/:id/stations/:stationId', ctrl.getStation);
router.put('/:id/stations/:stationId', authorize('admin', 'tecnico'), ctrl.updateStation);

// Termo de entrega (PDF e DOCX)
router.get('/:id/term/pdf', ctrl.termPdf);
router.get('/:id/term/docx', ctrl.termDocx);

module.exports = router;

const router = require('express').Router();
const ctrl = require('../controllers/equipment.controller');
const stockCtrl = require('../controllers/stockThreshold.controller');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorize } = require('../middlewares/auth');
const { createSchema, updateSchema } = require('../validations/equipment.validation');

router.use(authenticate);

// === CRUD ===
router.get('/', ctrl.list);
router.get('/summary', ctrl.summary);

// === Estoque ===
router.get('/stock/report', ctrl.stockReport);
router.post('/stock/check', authorize('admin'), ctrl.stockCheck);
router.get('/stock/thresholds', stockCtrl.list);
router.post('/stock/thresholds', authorize('admin'), stockCtrl.upsert);
router.delete('/stock/thresholds/:type', authorize('admin'), stockCtrl.remove);

// === Etiquetas em lote (PDF) ===
router.post('/labels/pdf', authorize('admin', 'tecnico'), ctrl.labelsPdf);

// === Importação em lote ===
router.post(
  '/import/batch',
  authorize('admin', 'tecnico'),
  upload.single('file'),
  ctrl.importBatch
);

// === Por item ===
router.get('/:id', ctrl.get);
router.post('/', authorize('admin', 'tecnico'), validate({ body: createSchema }), ctrl.create);
router.put('/:id', authorize('admin', 'tecnico'), validate({ body: updateSchema }), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

router.get('/:id/qrcode', ctrl.qrCode);
router.post('/:id/transfer', authorize('admin', 'tecnico'), ctrl.transfer);
router.get('/:id/movements/:movId/term', ctrl.deliveryTermPdf);

module.exports = router;

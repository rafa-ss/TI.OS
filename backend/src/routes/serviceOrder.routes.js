const router = require('express').Router();
const ctrl = require('../controllers/serviceOrder.controller');
const validate = require('../middlewares/validate');
const upload = require('../middlewares/upload');
const { authenticate, authorize } = require('../middlewares/auth');
const {
  createSchema,
  updateSchema,
  statusSchema,
  commentSchema,
} = require('../validations/serviceOrder.validation');

router.use(authenticate);

router.get('/', ctrl.list);
router.get('/:id', ctrl.get);
router.post('/', validate({ body: createSchema }), ctrl.create);
router.put('/:id', validate({ body: updateSchema }), ctrl.update);
router.delete('/:id', ctrl.remove); // permissão verificada no controller

router.post('/:id/start', ctrl.start);
router.get('/:id/print', ctrl.printPdf);
router.patch('/:id/status', validate({ body: statusSchema }), ctrl.changeStatus);
router.post('/:id/comments', validate({ body: commentSchema }), ctrl.addComment);
router.post('/:id/attachments', upload.array('files', 10), ctrl.uploadAttachments);
router.get('/:id/attachments/:attId/view', ctrl.viewAttachment);
router.delete('/:id/attachments/:attId', ctrl.removeAttachment);

module.exports = router;

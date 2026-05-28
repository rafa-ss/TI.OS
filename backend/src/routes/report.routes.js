const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const ctrl = require('../controllers/report.controller');

router.use(authenticate);

router.get('/orders/excel', ctrl.ordersExcel);
router.get('/orders/pdf', ctrl.ordersPdf);
router.get('/orders/by-technician', ctrl.byTechnician);
router.get('/orders/by-school', ctrl.bySchool);
router.get('/equipment/most-maintained', ctrl.mostMaintained);

module.exports = router;

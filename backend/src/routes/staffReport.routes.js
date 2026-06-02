const router = require('express').Router();
const ctrl = require('../controllers/staffReport.controller');
const { authenticate, authorize } = require('../middlewares/auth');

router.use(authenticate);

// Visão consolidada (JSON)
router.get('/activities', ctrl.getActivities);
router.get('/team-overview', authorize('admin'), ctrl.teamOverview);

// CRUD de atividades externas (manuais — para respaldo do ponto)
router.get('/manual', ctrl.listMyActivities);
router.post('/manual', ctrl.createActivity);
router.put('/manual/:id', ctrl.updateActivity);
router.delete('/manual/:id', ctrl.removeActivity);

// PDFs
router.get('/individual/pdf', ctrl.individualPdf);
router.get('/team/pdf', authorize('admin'), ctrl.teamPdf);

module.exports = router;

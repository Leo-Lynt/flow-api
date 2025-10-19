const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createSchedule,
  listSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  enableSchedule,
  disableSchedule
} = require('../controllers/scheduleController');

// Todas as rotas requerem autenticação
router.use(authenticate);

// CRUD de schedules
router.post('/', createSchedule);
router.get('/', listSchedules);
router.get('/:id', getSchedule);
router.put('/:id', updateSchedule);
router.delete('/:id', deleteSchedule);

// Ativar/desativar
router.post('/:id/enable', enableSchedule);
router.post('/:id/disable', disableSchedule);

module.exports = router;

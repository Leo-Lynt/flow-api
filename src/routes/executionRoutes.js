const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { listExecutions, saveExecution, getExecutionResponse, reexecuteFlow } = require('../controllers/executionController');

// GET /api/executions - Listar execuções do usuário
router.get('/', authenticate, listExecutions);

// POST /api/executions/save - Salvar execução do frontend
router.post('/save', authenticate, saveExecution);

// GET /api/executions/:id/response - Obter response de uma execução
router.get('/:id/response', authenticate, getExecutionResponse);

// POST /api/executions/:id/reexecute - Re-executar flow com os mesmos inputs
router.post('/:id/reexecute', authenticate, reexecuteFlow);

module.exports = router;

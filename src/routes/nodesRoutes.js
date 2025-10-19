/**
 * Nodes Routes
 * Rotas para servir catálogo de nodes do Core
 */

const express = require('express');
const router = express.Router();
const { getNodes, clearNodesCache } = require('../controllers/nodesController');

/**
 * GET /api/nodes
 * Retorna catálogo completo de nodes
 */
router.get('/', getNodes);

/**
 * POST /api/nodes/clear-cache
 * Limpa cache (útil em desenvolvimento)
 */
router.post('/clear-cache', clearNodesCache);

module.exports = router;

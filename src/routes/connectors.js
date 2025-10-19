const express = require('express');
const router = express.Router();
const connectorController = require('../controllers/connectorController');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { connectorExecuteSchema } = require('../middleware/validation');

// Todas as rotas requerem autenticação
router.use(authenticate);

/**
 * @swagger
 * /api/connectors/execute:
 *   post:
 *     summary: Executar busca de dados de múltiplas fontes
 *     tags: [Connectors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceType
 *               - config
 *             properties:
 *               sourceType:
 *                 type: string
 *                 enum: [api, analytics, database, json]
 *               config:
 *                 type: object
 *               temporalConfig:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   rangeType:
 *                     type: string
 *                     enum: [relative, absolute]
 *                   relativeRange:
 *                     type: string
 *                     enum: [today, last_7_days, last_30_days, last_90_days]
 *                   absoluteRange:
 *                     type: object
 *                     properties:
 *                       startDate:
 *                         type: string
 *                         format: date
 *                       endDate:
 *                         type: string
 *                         format: date
 *     responses:
 *       200:
 *         description: Dados obtidos com sucesso
 *       400:
 *         description: Erro de validação
 *       401:
 *         description: Não autorizado
 */
router.post('/execute', validate(connectorExecuteSchema), connectorController.executeConnector);

module.exports = router;
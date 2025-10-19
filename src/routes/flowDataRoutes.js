const express = require('express');
const router = express.Router();
const flowDataController = require('../controllers/flowDataController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * /api/flow-data/{id}:
 *   get:
 *     summary: Buscar FlowData por ID
 *     tags: [FlowData]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do FlowData
 *     responses:
 *       200:
 *         description: FlowData encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FlowData'
 *       404:
 *         description: FlowData não encontrado
 *       403:
 *         description: Acesso negado
 */
router.get('/flow-data/:id', authenticate, flowDataController.getFlowData);

/**
 * @swagger
 * /api/flow-data/{id}:
 *   put:
 *     summary: Atualizar FlowData
 *     tags: [FlowData]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do FlowData
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 nullable: true
 *                 description: 'Estrutura livre definida pelo usuário para armazenar a lógica do flow'
 *                 example:
 *                   nodes: [{"id": "node1", "type": "input"}]
 *                   edges: [{"from": "node1", "to": "node2"}]
 *                   config: {"theme": "dark"}
 *                   customField: "any value"
 *     responses:
 *       200:
 *         description: FlowData atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FlowData'
 *       404:
 *         description: FlowData não encontrado
 *       403:
 *         description: Acesso negado
 */
router.put('/flow-data/:id', authenticate, flowDataController.updateFlowData);

/**
 * @swagger
 * /api/flow-data/by-flow/{flowId}:
 *   get:
 *     summary: Buscar FlowData pelo ID do Flow
 *     tags: [FlowData]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do Flow
 *     responses:
 *       200:
 *         description: FlowData encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FlowData'
 *       404:
 *         description: Flow ou FlowData não encontrado
 *       403:
 *         description: Acesso negado
 */
router.get('/flow-data/by-flow/:flowId', authenticate, flowDataController.getFlowDataByFlowId);

/**
 * @swagger
 * /api/flow-data/{id}:
 *   delete:
 *     summary: Deletar FlowData
 *     tags: [FlowData]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do FlowData
 *     responses:
 *       200:
 *         description: FlowData deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: FlowData não encontrado
 *       403:
 *         description: Acesso negado
 */
router.delete('/flow-data/:id', authenticate, flowDataController.deleteFlowData);

module.exports = router;
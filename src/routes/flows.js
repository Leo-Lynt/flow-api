const express = require('express');
const router = express.Router();

const flowController = require('../controllers/flowController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const {
  validate,
  validateParams,
  validateQuery,
  createFlowSchema,
  updateFlowSchema,
  executeFlowSchema,
  mongoIdSchema,
  flowsQuerySchema
} = require('../middleware/validation');

// Rotas públicas

/**
 * @swagger
 * /api/flows/public:
 *   get:
 *     summary: Listar fluxos públicos
 *     tags: [Flows]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Itens por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou descrição
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filtrar por tags (separadas por vírgula)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, executionCount]
 *           default: createdAt
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Ordem da classificação
 *     responses:
 *       200:
 *         description: Lista de fluxos públicos
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         flows:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Flow'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationInfo'
 */
router.get('/public', validateQuery(flowsQuerySchema), optionalAuth, flowController.getPublicFlows);

// Rotas protegidas
router.use(authenticate); // Aplicar autenticação para todas as rotas abaixo

// CRUD de fluxos

/**
 * @swagger
 * /api/flows:
 *   get:
 *     summary: Listar fluxos do usuário
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, executionCount]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de fluxos do usuário
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         flows:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Flow'
 *                         pagination:
 *                           $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', validateQuery(flowsQuerySchema), flowController.getFlows);

/**
 * @swagger
 * /api/flows:
 *   post:
 *     summary: Criar novo fluxo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlowRequest'
 *     responses:
 *       201:
 *         description: Fluxo criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Flow'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/', validate(createFlowSchema), flowController.createFlow);

/**
 * @swagger
 * /api/flows/{id}:
 *   get:
 *     summary: Obter fluxo específico
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: ID do fluxo (ObjectId MongoDB)
 *     responses:
 *       200:
 *         description: Fluxo encontrado
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Flow'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', validateParams(mongoIdSchema), flowController.getFlow);

/**
 * @swagger
 * /api/flows/{id}:
 *   put:
 *     summary: Atualizar fluxo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               flowData:
 *                 $ref: '#/components/schemas/FlowData'
 *               isPublic:
 *                 type: boolean
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Fluxo atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Flow'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.put('/:id', validateParams(mongoIdSchema), validate(updateFlowSchema), flowController.updateFlow);

/**
 * @swagger
 * /api/flows/{id}:
 *   delete:
 *     summary: Deletar fluxo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     responses:
 *       200:
 *         description: Fluxo deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', validateParams(mongoIdSchema), flowController.deleteFlow);

// Operações especiais

/**
 * @swagger
 * /api/flows/{id}/clone:
 *   post:
 *     summary: Clonar fluxo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     responses:
 *       201:
 *         description: Fluxo clonado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Flow'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/clone', validateParams(mongoIdSchema), flowController.cloneFlow);

/**
 * @swagger
 * /api/flows/{id}/stats:
 *   get:
 *     summary: Obter estatísticas do fluxo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *     responses:
 *       200:
 *         description: Estatísticas do fluxo
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         nodeCount:
 *                           type: number
 *                           example: 4
 *                         connectionCount:
 *                           type: number
 *                           example: 3
 *                         executionCount:
 *                           type: number
 *                           example: 15
 *                         lastExecutedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         nodeTypes:
 *                           type: object
 *                           example: { "connector": 1, "field-extractor": 1, "output": 1 }
 *                         isValid:
 *                           type: boolean
 *                           example: true
 *                         validationErrors:
 *                           type: array
 *                           items:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/stats', validateParams(mongoIdSchema), flowController.getFlowStats);

// Execução de fluxos

/**
 * @swagger
 * /api/flows/{id}/execute:
 *   post:
 *     summary: Executar fluxo completo
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: ID do fluxo (ObjectId MongoDB)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inputData:
 *                 type: object
 *                 description: Dados de entrada para o fluxo
 *                 example: {}
 *               options:
 *                 type: object
 *                 properties:
 *                   saveResult:
 *                     type: boolean
 *                     default: false
 *                     description: Salvar resultado da execução no banco
 *                   includeNodeResults:
 *                     type: boolean
 *                     default: false
 *                     description: Incluir resultados individuais dos nodes na resposta
 *     responses:
 *       200:
 *         description: Fluxo executado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         outputData:
 *                           type: object
 *                           description: Dados de saída do fluxo
 *                         executionTime:
 *                           type: number
 *                           description: Tempo de execução em milissegundos
 *                           example: 1234
 *                         nodesExecuted:
 *                           type: number
 *                           description: Número de nodes executados
 *                           example: 5
 *       400:
 *         description: Erro de validação ou fluxo vazio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Fluxo não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       408:
 *         description: Timeout na execução
 *       500:
 *         description: Erro na execução do fluxo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/:id/execute', validateParams(mongoIdSchema), validate(executeFlowSchema), flowController.executeFlow);

/**
 * @swagger
 * /api/flows/{id}/inputs:
 *   get:
 *     summary: Obter inputs de um flow específico
 *     tags: [Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^[0-9a-fA-F]{24}$'
 *         description: ID do fluxo (ObjectId MongoDB)
 *     responses:
 *       200:
 *         description: Lista de inputs do flow
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         flowId:
 *                           type: string
 *                         flowName:
 *                           type: string
 *                         totalInputs:
 *                           type: number
 *                         inputs:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               required:
 *                                 type: boolean
 *                               defaultValue:
 *                                 type: any
 *                               description:
 *                                 type: string
 *                               nodeId:
 *                                 type: string
 *                               nodeName:
 *                                 type: string
 *                         example:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id/inputs', validateParams(mongoIdSchema), flowController.getFlowInputs);

module.exports = router;
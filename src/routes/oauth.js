const express = require('express');
const router = express.Router();
const oauthController = require('../controllers/oauthController');
const { authenticate } = require('../middleware/auth');
const { validateParams } = require('../middleware/validation');
const Joi = require('joi');

// Schema de validação
const providerParamSchema = Joi.object({
  provider: Joi.string().valid('google', 'google_analytics', 'google_sheets').required()
});

const googleAuthorizeSchema = Joi.object({
  scopes: Joi.string().optional(), // Ex: "analytics,sheets" ou "profile"
  purpose: Joi.string().valid('connection', 'authentication').default('connection'),
  serviceType: Joi.string().valid('analytics', 'sheets', 'drive', 'gmail').optional(),
  state: Joi.string().optional()
});

const connectionIdSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required()
});

/**
 * @swagger
 * /api/oauth/{provider}/authorize:
 *   get:
 *     summary: Iniciar fluxo OAuth (use provider=google com scopes dinâmicos)
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [google, google_analytics, google_sheets]
 *         description: Use 'google' com query params. google_analytics e google_sheets são DEPRECATED.
 *       - in: query
 *         name: scopes
 *         schema:
 *           type: string
 *         description: Scopes separados por vírgula (analytics, sheets, profile, drive)
 *         example: analytics,sheets
 *       - in: query
 *         name: purpose
 *         schema:
 *           type: string
 *           enum: [connection, authentication]
 *         description: connection=API access, authentication=login social
 *         default: connection
 *       - in: query
 *         name: serviceType
 *         schema:
 *           type: string
 *           enum: [analytics, sheets, drive, gmail]
 *         description: Tipo de serviço Google (para organização)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Estado customizado opcional
 *     responses:
 *       200:
 *         description: URL de autorização gerada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     authUrl:
 *                       type: string
 *                       description: URL para redirecionar o usuário
 *                     provider:
 *                       type: string
 *                     purpose:
 *                       type: string
 *                     serviceType:
 *                       type: string
 */
router.get(
  '/:provider/authorize',
  authenticate,
  validateParams(providerParamSchema),
  oauthController.authorize
);

/**
 * @swagger
 * /api/oauth/{provider}/callback:
 *   get:
 *     summary: Callback OAuth (chamado pelo provider)
 *     tags: [OAuth]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redireciona para o frontend
 */
router.get(
  '/:provider/callback',
  validateParams(providerParamSchema),
  oauthController.callback
);

/**
 * @swagger
 * /api/oauth/connections:
 *   get:
 *     summary: Listar conexões OAuth do usuário
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [google_analytics]
 *     responses:
 *       200:
 *         description: Lista de conexões
 */
router.get('/connections', authenticate, oauthController.listConnections);

/**
 * @swagger
 * /api/oauth/connections/{id}:
 *   get:
 *     summary: Obter conexão específica
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conexão encontrada
 */
router.get(
  '/connections/:id',
  authenticate,
  validateParams(connectionIdSchema),
  oauthController.getConnection
);

/**
 * @swagger
 * /api/oauth/connections/{id}/refresh:
 *   post:
 *     summary: Renovar token manualmente
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Token renovado
 */
router.post(
  '/connections/:id/refresh',
  authenticate,
  validateParams(connectionIdSchema),
  oauthController.refreshToken
);

/**
 * @swagger
 * /api/oauth/connections/{id}/test:
 *   post:
 *     summary: Testar conexão
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conexão válida
 */
router.post(
  '/connections/:id/test',
  authenticate,
  validateParams(connectionIdSchema),
  oauthController.testConnection
);

/**
 * @swagger
 * /api/oauth/connections/{id}:
 *   delete:
 *     summary: Revogar/deletar conexão
 *     tags: [OAuth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conexão revogada
 */
router.delete(
  '/connections/:id',
  authenticate,
  validateParams(connectionIdSchema),
  oauthController.revokeConnection
);

module.exports = router;
const express = require('express');
const router = express.Router();
const publicFlowController = require('../controllers/publicFlowController');
const { authenticate } = require('../middleware/auth');
const isModerator = require('../middleware/isModerator');

// ==================== PUBLIC ROUTES (sem autenticação) ====================

/**
 * @swagger
 * /api/public-flows:
 *   get:
 *     summary: Lista flows públicos
 *     tags: [Public Flows]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Tags separadas por vírgula
 *       - in: query
 *         name: verifiedOnly
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [popular, rating, recent, name]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de flows públicos
 */
router.get('/', publicFlowController.listPublicFlows);

/**
 * @swagger
 * /api/public-flows/stats:
 *   get:
 *     summary: Estatísticas da biblioteca pública
 *     tags: [Public Flows]
 *     responses:
 *       200:
 *         description: Estatísticas
 */
router.get('/stats', publicFlowController.getLibraryStats);

/**
 * @swagger
 * /api/public-flows/{flowId}:
 *   get:
 *     summary: Detalhes de um flow público
 *     tags: [Public Flows]
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do flow
 *       404:
 *         description: Flow não encontrado
 */
router.get('/:flowId', publicFlowController.getPublicFlowDetails);

/**
 * @swagger
 * /api/public-flows/{flowId}/reviews:
 *   get:
 *     summary: Lista reviews de um flow
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [helpful, recent, rating_high, rating_low]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de reviews
 */
router.get('/:flowId/reviews', publicFlowController.listReviews);

// ==================== AUTHENTICATED ROUTES ====================

router.use(authenticate);

/**
 * @swagger
 * /api/public-flows/{flowId}/publish:
 *   post:
 *     summary: Publica um flow
 *     tags: [Public Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - detailedDescription
 *               - tags
 *               - difficulty
 *             properties:
 *               detailedDescription:
 *                 type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               difficulty:
 *                 type: string
 *                 enum: [beginner, intermediate, advanced]
 *               license:
 *                 type: string
 *                 enum: [MIT, Apache-2.0, CC-BY-4.0, All-Rights-Reserved]
 *               allowForking:
 *                 type: boolean
 *               requireAttribution:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Flow publicado
 *       400:
 *         description: Erro de validação
 */
router.post('/:flowId/publish', publicFlowController.publishFlow);

/**
 * @swagger
 * /api/public-flows/{flowId}/unpublish:
 *   post:
 *     summary: Despublica um flow
 *     tags: [Public Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flow despublicado
 */
router.post('/:flowId/unpublish', publicFlowController.unpublishFlow);

/**
 * @swagger
 * /api/public-flows/{flowId}/import:
 *   post:
 *     summary: Importa um flow público
 *     tags: [Public Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flow importado
 */
router.post('/:flowId/import', publicFlowController.importFlow);

/**
 * @swagger
 * /api/public-flows/{flowId}/fork:
 *   post:
 *     summary: Cria um fork de um flow
 *     tags: [Public Flows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Fork criado
 */
router.post('/:flowId/fork', publicFlowController.forkFlow);

// ==================== REVIEWS ====================

/**
 * @swagger
 * /api/public-flows/{flowId}/reviews:
 *   post:
 *     summary: Cria uma review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *               - comment
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review criada
 */
router.post('/:flowId/reviews', publicFlowController.createReview);

/**
 * @swagger
 * /api/public-flows/{flowId}/reviews/me:
 *   get:
 *     summary: Obtém review do usuário para um flow
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review do usuário
 */
router.get('/:flowId/reviews/me', publicFlowController.getUserReview);

/**
 * @swagger
 * /api/public-flows/reviews/{reviewId}:
 *   put:
 *     summary: Atualiza uma review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *               title:
 *                 type: string
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review atualizada
 */
router.put('/reviews/:reviewId', publicFlowController.updateReview);

/**
 * @swagger
 * /api/public-flows/reviews/{reviewId}:
 *   delete:
 *     summary: Deleta uma review
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review deletada
 */
router.delete('/reviews/:reviewId', publicFlowController.deleteReview);

/**
 * @swagger
 * /api/public-flows/reviews/{reviewId}/helpful:
 *   post:
 *     summary: Marca/desmarca review como útil
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Review marcada/desmarcada
 */
router.post('/reviews/:reviewId/helpful', publicFlowController.markReviewHelpful);

// ==================== REPORTS ====================

/**
 * @swagger
 * /api/public-flows/{flowId}/report:
 *   post:
 *     summary: Reporta um flow
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - reason
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [spam, malicious, broken, duplicate, inappropriate]
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Report criado
 */
router.post('/:flowId/report', publicFlowController.createReport);

// ==================== MODERATION (apenas moderadores) ====================

/**
 * @swagger
 * /api/public-flows/moderation/pending:
 *   get:
 *     summary: Lista flows pendentes de aprovação
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de flows pendentes
 *       403:
 *         description: Acesso negado
 */
router.get('/moderation/pending', isModerator, publicFlowController.listPendingFlows);

/**
 * @swagger
 * /api/public-flows/moderation/reports:
 *   get:
 *     summary: Lista reports
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de reports
 */
router.get('/moderation/reports', isModerator, publicFlowController.listReports);

/**
 * @swagger
 * /api/public-flows/moderation/stats:
 *   get:
 *     summary: Estatísticas de moderação
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas
 */
router.get('/moderation/stats', isModerator, publicFlowController.getModerationStats);

/**
 * @swagger
 * /api/public-flows/moderation/{flowId}/approve:
 *   post:
 *     summary: Aprova um flow
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flow aprovado
 */
router.post('/moderation/:flowId/approve', isModerator, publicFlowController.approveFlow);

/**
 * @swagger
 * /api/public-flows/moderation/{flowId}/reject:
 *   post:
 *     summary: Rejeita um flow
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flow rejeitado
 */
router.post('/moderation/:flowId/reject', isModerator, publicFlowController.rejectFlow);

/**
 * @swagger
 * /api/public-flows/moderation/{flowId}/verify:
 *   post:
 *     summary: Adiciona badge de verificado
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flow verificado
 */
router.post('/moderation/:flowId/verify', isModerator, publicFlowController.verifyFlow);

/**
 * @swagger
 * /api/public-flows/moderation/all-flows:
 *   get:
 *     summary: Lista todos os flows públicos aprovados (moderadores)
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: verified
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [recent, popular, rating, verified]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de flows públicos aprovados
 */
router.get('/moderation/all-flows', isModerator, publicFlowController.listAllPublicFlows);

/**
 * @swagger
 * /api/public-flows/moderation/{flowId}/unverify:
 *   post:
 *     summary: Remove verificação de um flow
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verificação removida
 */
router.post('/moderation/:flowId/unverify', isModerator, publicFlowController.unverifyFlow);

/**
 * @swagger
 * /api/public-flows/moderation/{flowId}/quarantine:
 *   post:
 *     summary: Move flow para quarentena
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Flow movido para quarentena
 */
router.post('/moderation/:flowId/quarantine', isModerator, publicFlowController.quarantineFlow);

/**
 * @swagger
 * /api/public-flows/moderation/reports/{reportId}/resolve:
 *   post:
 *     summary: Resolve um report
 *     tags: [Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [quarantine, delete, warn_author, ban_author, no_action]
 *               reviewNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Report resolvido
 */
router.post('/moderation/reports/:reportId/resolve', isModerator, publicFlowController.resolveReport);

// ==================== DEBUG/DEVELOPMENT ROUTES ====================
// TODO: Remover em produção ou proteger adequadamente

/**
 * @swagger
 * /api/public-flows/debug/approve/{flowId}:
 *   post:
 *     summary: "[DEBUG] Aprova um flow sem moderação"
 *     tags: [Debug]
 *     parameters:
 *       - in: path
 *         name: flowId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Flow aprovado
 */
router.post('/debug/approve/:flowId', async (req, res) => {
  try {
    const Flow = require('../models/Flow');
    const flow = await Flow.findById(req.params.flowId);

    if (!flow) {
      return res.status(404).json({ success: false, error: 'Flow não encontrado' });
    }

    flow.publicationData = flow.publicationData || {};
    flow.publicationData.status = 'approved';
    flow.publicationData.moderationNotes = 'Aprovado via endpoint de debug';
    flow.isPublic = true;
    await flow.save();

    return res.json({ success: true, message: 'Flow aprovado!', flow });
  } catch (error) {
    console.error('Error approving flow:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

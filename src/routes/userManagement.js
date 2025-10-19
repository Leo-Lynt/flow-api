const express = require('express');
const router = express.Router();
const userManagementController = require('../controllers/userManagementController');
const { authenticate } = require('../middleware/auth');
const { isAdministrator, isModerator } = require('../middleware/checkRole');

// Todas as rotas requerem autenticação de administrador
router.use(authenticate);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lista todos os usuários (admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, moderator, administrator]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get('/users', isAdministrator, userManagementController.listUsers);

/**
 * @swagger
 * /api/admin/users/stats:
 *   get:
 *     summary: Obtém estatísticas de usuários (admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas de usuários
 */
router.get('/users/stats', isAdministrator, userManagementController.getUserStats);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Obtém detalhes de um usuário (admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes do usuário
 */
router.get('/users/:userId', isAdministrator, userManagementController.getUserDetails);

/**
 * @swagger
 * /api/admin/users/{userId}/role:
 *   put:
 *     summary: Atualiza o role de um usuário (admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, moderator, administrator]
 *     responses:
 *       200:
 *         description: Role atualizado
 */
router.put('/users/:userId/role', isAdministrator, userManagementController.updateUserRole);

/**
 * @swagger
 * /api/admin/users/{userId}/status:
 *   put:
 *     summary: Ativa/desativa um usuário (admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status atualizado
 */
router.put('/users/:userId/status', isAdministrator, userManagementController.toggleUserStatus);

/**
 * @swagger
 * /api/admin/users/{userId}/verified-creator:
 *   put:
 *     summary: Marca/desmarca usuário como criador verificado (moderador ou admin)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - isVerified
 *             properties:
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status de criador verificado atualizado
 */
router.put('/users/:userId/verified-creator', isModerator, userManagementController.toggleVerifiedCreator);

module.exports = router;

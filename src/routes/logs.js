const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');
const { authenticate } = require('../middleware/auth');

// Detectar ambiente serverless
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Apply authentication to all log routes
router.use(authenticate);

// Middleware para desabilitar rotas de logs em serverless
if (isServerless) {
  router.use((req, res) => {
    res.status(503).json({
      success: false,
      error: {
        message: 'Log file operations are not available in serverless environment.',
        code: 'LOGS_UNAVAILABLE_SERVERLESS',
        suggestion: 'Use Vercel Dashboard or configure a cloud logging service (Datadog, LogTail, etc.)'
      }
    });
  });
}

/**
 * @swagger
 * /api/logs/files:
 *   get:
 *     summary: List available log files
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of log files
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
 *                     files:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/files', logController.listFiles);

/**
 * @swagger
 * /api/logs/today:
 *   get:
 *     summary: Get today's logs
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [error, warn, info, debug]
 *     responses:
 *       200:
 *         description: Today's logs
 */
router.get('/today', logController.getTodayLogs);

/**
 * @swagger
 * /api/logs/search:
 *   get:
 *     summary: Search across all log files
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', logController.searchLogs);

/**
 * @swagger
 * /api/logs/stats:
 *   get:
 *     summary: Get log statistics
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filename
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Log statistics
 */
router.get('/stats', logController.getStats);

/**
 * @swagger
 * /api/logs/download/{filename}:
 *   get:
 *     summary: Download log file
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Log file download
 */
router.get('/download/:filename', logController.downloadLog);

module.exports = router;

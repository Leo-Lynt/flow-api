const express = require('express');
const router = express.Router();
const outputController = require('../controllers/outputController');
const { authenticate } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Output
 *   description: Output destinations for processed data
 */

/**
 * @swagger
 * /api/output/api-response:
 *   post:
 *     summary: Return formatted API response
 *     tags: [Output]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               config:
 *                 type: object
 *                 properties:
 *                   payloadType:
 *                     type: string
 *                     enum: [data_only, wrapped, full]
 *                   statusCode:
 *                     type: number
 *               flowId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Formatted response
 */
router.post('/api-response', authenticate, outputController.apiResponse);

/**
 * @swagger
 * /api/output/webhook:
 *   post:
 *     summary: Send data to webhook URL
 *     tags: [Output]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               config:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                   method:
 *                     type: string
 *                     enum: [POST, PUT, PATCH]
 *                   headers:
 *                     type: object
 *                   retry:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Webhook delivered successfully
 */
router.post('/webhook', authenticate, outputController.webhook);

/**
 * @swagger
 * /api/output/email:
 *   post:
 *     summary: Send data via email
 *     tags: [Output]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               config:
 *                 type: object
 *                 properties:
 *                   to:
 *                     type: string
 *                   subject:
 *                     type: string
 *                   format:
 *                     type: string
 *                     enum: [html, json, csv]
 *     responses:
 *       200:
 *         description: Email sent successfully
 */
router.post('/email', authenticate, outputController.email);

/**
 * @swagger
 * /api/output/google-sheets:
 *   post:
 *     summary: Write data to Google Sheets
 *     tags: [Output]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               config:
 *                 type: object
 *                 properties:
 *                   spreadsheetUrl:
 *                     type: string
 *                   sheetName:
 *                     type: string
 *                   writeMode:
 *                     type: string
 *                     enum: [append, replace, update]
 *     responses:
 *       200:
 *         description: Data written to Google Sheets
 */
router.post('/google-sheets', authenticate, outputController.googleSheets);

/**
 * @swagger
 * /api/output/download:
 *   post:
 *     summary: Generate file download
 *     tags: [Output]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *               config:
 *                 type: object
 *                 properties:
 *                   format:
 *                     type: string
 *                     enum: [json, csv, excel]
 *                   filename:
 *                     type: string
 *     responses:
 *       200:
 *         description: File download
 */
router.post('/download', authenticate, outputController.download);

module.exports = router;

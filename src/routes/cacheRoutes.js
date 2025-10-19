const express = require('express');
const router = express.Router();
const { getCacheStats, clearAllCache, clearFlowCache } = require('../controllers/cacheController');
const { authenticate } = require('../middleware/auth');

// GET /api/cache/stats
router.get('/stats', authenticate, getCacheStats);

// POST /api/cache/clear
router.post('/clear', authenticate, clearAllCache);

// POST /api/cache/clear/:flowId
router.post('/clear/:flowId', authenticate, clearFlowCache);

module.exports = router;

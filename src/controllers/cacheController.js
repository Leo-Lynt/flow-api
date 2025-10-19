const intelligentCache = require('../utils/intelligentCache');

/**
 * GET /api/cache/stats
 * Obter estatísticas do cache
 */
async function getCacheStats(req, res) {
  try {
    const stats = intelligentCache.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * POST /api/cache/clear
 * Limpar todo o cache
 */
async function clearAllCache(req, res) {
  try {
    await intelligentCache.clearAll();

    res.json({
      success: true,
      message: 'All cache cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

/**
 * POST /api/cache/clear/:flowId
 * Limpar cache de um flow específico
 */
async function clearFlowCache(req, res) {
  try {
    const { flowId } = req.params;

    await intelligentCache.clearFlowCache(flowId);

    res.json({
      success: true,
      message: `Cache cleared for flow ${flowId}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    });
  }
}

module.exports = {
  getCacheStats,
  clearAllCache,
  clearFlowCache
};

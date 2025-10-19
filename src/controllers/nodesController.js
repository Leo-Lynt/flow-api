/**
 * Nodes Controller
 * Serve o catálogo de nodes do Core
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Cache do nodes.json
 */
let nodesCache = null;
let nodesCacheTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Carrega nodes.json do Core
 */
async function loadNodesFromCore() {
  // Se cache válido, retornar
  if (nodesCache && nodesCacheTime && (Date.now() - nodesCacheTime) < CACHE_TTL) {
    return nodesCache;
  }

  try {
    // Caminho para nodes.json no Core
    const nodesPath = path.join(__dirname, '../../../core/src/config/nodes.json');
    const nodesContent = await fs.readFile(nodesPath, 'utf8');
    const nodesData = JSON.parse(nodesContent);

    // Atualizar cache
    nodesCache = nodesData;
    nodesCacheTime = Date.now();

    return nodesData;
  } catch (error) {
    console.error('❌ Erro ao carregar nodes.json do Core:', error);
    throw new Error('Failed to load nodes catalog');
  }
}

/**
 * GET /api/nodes
 * Retorna catálogo completo de nodes
 */
async function getNodes(req, res) {
  try {
    const nodes = await loadNodesFromCore();

    res.json({
      success: true,
      data: nodes,
      version: nodesCacheTime, // Timestamp como versão
      cached: nodesCache !== null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'NODES_LOAD_ERROR'
      }
    });
  }
}

/**
 * POST /api/nodes/clear-cache
 * Limpa cache do nodes.json (útil em desenvolvimento)
 */
function clearNodesCache(req, res) {
  nodesCache = null;
  nodesCacheTime = null;

  res.json({
    success: true,
    message: 'Nodes cache cleared'
  });
}

module.exports = {
  getNodes,
  clearNodesCache
};

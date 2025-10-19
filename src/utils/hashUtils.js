const crypto = require('crypto');

/**
 * Gera hash MD5 de um objeto
 * @param {Object} obj - Objeto para hash
 * @returns {string} Hash MD5
 */
function generateHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Gera hash único para um node incluindo suas dependências
 * @param {string} nodeId - ID do node
 * @param {Object} nodeData - Configuração do node
 * @param {Object} upstreamHashes - Hashes dos nodes upstream
 * @returns {string} Hash único
 */
function generateNodeHash(nodeId, nodeData, upstreamHashes = {}) {
  const hashInput = {
    nodeId,
    type: nodeData.type,
    config: nodeData.data || nodeData.config || {},
    function: nodeData.data?.function,
    upstreamHashes: Object.keys(upstreamHashes).sort().reduce((acc, key) => {
      acc[key] = upstreamHashes[key];
      return acc;
    }, {})
  };

  // Para Input nodes, incluir inputData no hash
  if (nodeData.inputData) {
    hashInput.inputData = nodeData.inputData;
  }

  return generateHash(hashInput);
}

module.exports = {
  generateHash,
  generateNodeHash
};

const crypto = require('crypto');

// Gerar ID único para nós
const generateNodeId = (type) => {
  return `${type}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

// Validar estrutura básica de um fluxo
const validateFlowStructure = (flowData) => {
  if (!flowData || typeof flowData !== 'object') {
    return { valid: false, error: 'FlowData deve ser um objeto' };
  }

  if (!Array.isArray(flowData.nodes)) {
    return { valid: false, error: 'Nodes deve ser um array' };
  }

  if (!Array.isArray(flowData.edges)) {
    return { valid: false, error: 'Edges deve ser um array' };
  }

  if (flowData.globalVariables && typeof flowData.globalVariables !== 'object') {
    return { valid: false, error: 'GlobalVariables deve ser um objeto' };
  }

  return { valid: true };
};

// Tipos de nós válidos
const VALID_NODE_TYPES = [
  'connector',
  'field-extractor',
  'array-processor',
  'variable',
  'output',
  'add',
  'subtract',
  'multiply',
  'divide'
];

// Validar tipos de nós
const validateNodeTypes = (nodes) => {
  for (const node of nodes) {
    if (!VALID_NODE_TYPES.includes(node.type)) {
      return { valid: false, error: `Tipo de nó inválido: ${node.type}` };
    }
  }
  return { valid: true };
};

// Formatar resposta de erro
const formatError = (message, code = 'GENERIC_ERROR', details = null) => {
  return {
    success: false,
    error: {
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    }
  };
};

// Formatar resposta de sucesso
const formatSuccess = (data, message = 'Operação realizada com sucesso') => {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
};

// Calcular tempo de execução
const calculateExecutionTime = (startTime) => {
  const endTime = Date.now();
  return endTime - startTime;
};

// Limpar dados sensíveis do usuário
const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.refreshToken;
  return userObj;
};

module.exports = {
  generateNodeId,
  validateFlowStructure,
  validateNodeTypes,
  formatError,
  formatSuccess,
  calculateExecutionTime,
  sanitizeUser,
  VALID_NODE_TYPES
};
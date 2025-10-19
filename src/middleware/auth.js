const authService = require('../services/authService');
const { formatError } = require('../utils/helpers');

// Middleware de autenticação
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(formatError('Token de acesso requerido', 'MISSING_TOKEN'));
    }

    const token = authHeader.substring(7);

    try {
      const decoded = authService.verifyToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json(formatError('Token inválido', 'INVALID_TOKEN'));
    }
  } catch (error) {
    return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
  }
};

// Middleware opcional de autenticação (não obrigatório)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = authService.verifyToken(token);
        req.user = decoded;
      } catch (error) {
        // Token inválido, mas não bloqueia a requisição
      }
    }

    next();
  } catch (error) {
    return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
  }
};

// Middleware para verificar propriedade de recurso
const checkResourceOwnership = (resourceModel, resourceIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[resourceIdParam];
      const userId = req.user.userId;

      const resource = await resourceModel.findById(resourceId);

      if (!resource) {
        return res.status(404).json(formatError('Recurso não encontrado', 'RESOURCE_NOT_FOUND'));
      }

      if (resource.userId.toString() !== userId) {
        return res.status(403).json(formatError('Acesso negado', 'ACCESS_DENIED'));
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  checkResourceOwnership
};
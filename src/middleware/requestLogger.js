const { v4: uuidv4 } = require('crypto').randomUUID ? { v4: () => require('crypto').randomUUID() } : require('uuid');
const logger = require('../utils/logger');

/**
 * Middleware para adicionar correlation ID e logar requisições
 */
function requestLoggerMiddleware(req, res, next) {
  // Adicionar correlation ID único para rastrear requisições
  req.correlationId = req.get('X-Correlation-ID') || uuidv4();

  // Adicionar correlation ID na resposta
  res.setHeader('X-Correlation-ID', req.correlationId);

  // Capturar início do request
  const startTime = Date.now();

  // Capture response body
  const originalJson = res.json;
  const originalSend = res.send;
  let responseBody = null;

  res.json = function(data) {
    responseBody = data;
    return originalJson.call(this, data);
  };

  res.send = function(data) {
    if (!responseBody && typeof data === 'string') {
      try {
        responseBody = JSON.parse(data);
      } catch (e) {
        responseBody = data;
      }
    }
    return originalSend.call(this, data);
  };

  // Logar quando a resposta for enviada
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    // NÃO capturar responseBody de requisições de logs para evitar recursão infinita
    const url = req.originalUrl || req.url;
    const shouldCaptureResponse = !url.startsWith('/api/logs') && !url.includes('/logs');

    // Usar o helper do logger
    logger.logRequest(req, res, duration, shouldCaptureResponse ? responseBody : null);
  });

  next();
}

module.exports = requestLoggerMiddleware;

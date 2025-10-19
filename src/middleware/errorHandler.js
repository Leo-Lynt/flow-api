const { formatError } = require('../utils/helpers');

// Middleware para capturar erros não tratados
const errorHandler = (err, req, res, next) => {
  // Log do erro
  console.error('Erro capturado pelo middleware:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });

  // Resposta baseada no tipo de erro
  if (err.name === 'ValidationError') {
    // Erro de validação do Mongoose
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR', errors));
  }

  if (err.name === 'CastError') {
    // Erro de cast do MongoDB (ID inválido)
    return res.status(400).json(formatError('ID inválido fornecido', 'INVALID_ID'));
  }

  if (err.code === 11000) {
    // Erro de duplicação no MongoDB
    const field = Object.keys(err.keyPattern)[0];
    return res.status(400).json(formatError(`${field} já existe`, 'DUPLICATE_ERROR'));
  }

  if (err.name === 'JsonWebTokenError') {
    // Erro de JWT
    return res.status(401).json(formatError('Token inválido', 'INVALID_TOKEN'));
  }

  if (err.name === 'TokenExpiredError') {
    // Token expirado
    return res.status(401).json(formatError('Token expirado', 'TOKEN_EXPIRED'));
  }

  if (err.status || err.statusCode) {
    // Erro HTTP com status definido
    return res.status(err.status || err.statusCode).json(
      formatError(err.message || 'Erro do servidor', 'HTTP_ERROR')
    );
  }

  // Erro genérico do servidor
  const isDevelopment = process.env.NODE_ENV === 'development';

  return res.status(500).json(formatError(
    isDevelopment ? err.message : 'Erro interno do servidor',
    'INTERNAL_ERROR',
    isDevelopment ? { stack: err.stack } : null
  ));
};

// Middleware para capturar rotas não encontradas
const notFoundHandler = (req, res) => {
  return res.status(404).json(formatError(
    `Rota ${req.method} ${req.path} não encontrada`,
    'ROUTE_NOT_FOUND'
  ));
};

// Middleware de logging de requisições
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Log da requisição
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.userId,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Interceptar a resposta para log
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;

    console.log(`${new Date().toISOString()} - Response ${req.method} ${req.url}`, {
      status: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId
    });

    return originalSend.call(this, data);
  };

  next();
};

// Middleware de rate limiting por usuário
const createUserRateLimit = () => {
  const userRequests = new Map();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutos
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

  return (req, res, next) => {
    const userId = req.user?.userId;
    if (!userId) {
      return next(); // Pular se não autenticado
    }

    const now = Date.now();
    const userKey = userId.toString();

    // Limpar registros antigos
    if (userRequests.has(userKey)) {
      const requests = userRequests.get(userKey);
      const validRequests = requests.filter(time => now - time < windowMs);
      userRequests.set(userKey, validRequests);
    }

    // Obter requisições do usuário
    const requests = userRequests.get(userKey) || [];

    if (requests.length >= maxRequests) {
      return res.status(429).json(formatError(
        'Muitas requisições. Tente novamente mais tarde.',
        'RATE_LIMIT_EXCEEDED',
        {
          limit: maxRequests,
          windowMs,
          resetTime: new Date(requests[0] + windowMs).toISOString()
        }
      ));
    }

    // Adicionar requisição atual
    requests.push(now);
    userRequests.set(userKey, requests);

    // Adicionar headers de rate limit
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - requests.length,
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });

    next();
  };
};

// Middleware para sanitizar logs (remover dados sensíveis)
const sanitizeRequestData = (req, res, next) => {
  // Criar cópia limpa do body para logs
  if (req.body && typeof req.body === 'object') {
    const sanitizedBody = { ...req.body };

    // Remover campos sensíveis
    const sensitiveFields = ['password', 'token', 'refreshToken', 'apiKey', 'secret'];
    sensitiveFields.forEach(field => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '[REDACTED]';
      }
    });

    req.sanitizedBody = sanitizedBody;
  }

  next();
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestLogger,
  createUserRateLimit,
  sanitizeRequestData
};
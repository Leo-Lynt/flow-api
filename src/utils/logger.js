const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Formato customizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato para console (desenvolvimento)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Criar pasta de logs se não existir
const logsDir = path.join(__dirname, '../../logs');
const fs = require('fs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Transport para arquivo com rotação diária
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'flowforge-api-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: customFormat,
  level: 'debug'
});

// Transport para erros
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'flowforge-error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  level: 'error',
  format: customFormat
});

// Criar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: {
    service: 'flowforge-api',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    fileRotateTransport,
    errorFileTransport
  ]
});

// Adicionar console transport em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Helper functions para logging estruturado
logger.logRequest = (req, res, duration, responseBody) => {
  const logData = {
    type: 'http_request',
    method: req.method,
    url: req.originalUrl || req.url,
    path: req.path,
    statusCode: res.statusCode,
    duration: duration,
    correlationId: req.correlationId,
    userId: req.user?.userId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestBody: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
    responseBody: responseBody
  };

  if (res.statusCode >= 500) {
    logger.error('HTTP Request Error', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request Warning', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

logger.logFlowExecution = (flowId, userId, status, duration, meta = {}) => {
  logger.info('Flow Execution', {
    type: 'flow_execution',
    flowId,
    userId,
    status,
    duration: `${duration}ms`,
    ...meta
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application Error', {
    type: 'app_error',
    message: error.message,
    stack: error.stack,
    ...context
  });
};

module.exports = logger;

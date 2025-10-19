require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const logger = require('./utils/logger');
const requestLoggerMiddleware = require('./middleware/requestLogger');


// Conectar ao banco de dados
const connectDB = require('./utils/database');

// Importar rotas
const authRoutes = require('./routes/auth');
const flowRoutes = require('./routes/flows');
const flowDataRoutes = require('./routes/flowDataRoutes');
const connectorRoutes = require('./routes/connectors');
const oauthRoutes = require('./routes/oauth');
const outputRoutes = require('./routes/output');
const logRoutes = require('./routes/logs');
const nodesRoutes = require('./routes/nodesRoutes');
const cacheRoutes = require('./routes/cacheRoutes');
const executionRoutes = require('./routes/executionRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');
const publicFlowRoutes = require('./routes/publicFlows');
const userManagementRoutes = require('./routes/userManagement');

// Importar middleware
const {
  errorHandler,
  notFoundHandler,
  requestLogger,
  createUserRateLimit,
  sanitizeRequestData
} = require('./middleware/errorHandler');

// Conectar ao MongoDB
connectDB();

const app = express();

// Configurações de segurança
app.use(helmet({
  contentSecurityPolicy: false // Desabilitar CSP para APIs
}));

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5176', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware básico
app.use(express.json({ limit: '10mb' })); // Aumentar limite para fluxos grandes
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (Log Viewer)
app.use(express.static(path.join(__dirname, '../public')));

// Request Logger (correlation ID + logs estruturados)
app.use(requestLoggerMiddleware);

// Rate limiting global
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Limite por IP
  message: {
    success: false,
    error: {
      message: 'Muitas requisições deste IP. Tente novamente mais tarde.',
      code: 'RATE_LIMIT_EXCEEDED'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Middleware customizado
app.use(sanitizeRequestData);
// REMOVIDO: requestLogger duplicado (já temos requestLoggerMiddleware na linha 59)

// Configurar trust proxy de forma segura
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy && trustProxy !== 'false') {
  // Se for um número, converter para integer
  if (!isNaN(trustProxy)) {
    app.set('trust proxy', parseInt(trustProxy));
  }
  // Se contém vírgulas, tratar como lista de IPs
  else if (trustProxy.includes(',')) {
    app.set('trust proxy', trustProxy.split(',').map(ip => ip.trim()));
  }
  // Caso contrário, usar o valor como string (pode ser 'loopback', 'linklocal', etc.)
  else {
    app.set('trust proxy', trustProxy);
  }
} else {
  // Por padrão, não confiar em proxies para maior segurança
  app.set('trust proxy', false);
}

// Rota de health check
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar status da API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flow-Forge API está funcionando
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Flow-Forge API está funcionando',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Documentação Swagger
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Flow-Forge API Documentation',
  explorer: true,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Rota de informações da API
/**
 * @swagger
 * /api:
 *   get:
 *     summary: Informações gerais da API
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Informações da API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Flow-Forge API
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     auth:
 *                       type: string
 *                       example: /api/auth
 *                     flows:
 *                       type: string
 *                       example: /api/flows
 *                     executions:
 *                       type: string
 *                       example: /api/executions
 *                 documentation:
 *                   type: string
 *                   example: /api/docs
 *                 health:
 *                   type: string
 *                   example: /health
 */
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Flow-Forge API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      flows: '/api/flows',
      flowData: '/api/flow-data',
      connectors: '/api/connectors',
      oauth: '/api/oauth',
      output: '/api/output',
      logs: '/api/logs'
    },
    documentation: '/api/docs',
    logViewer: '/logs.html',
    health: '/health'
  });
});

// Rate limiting específico por usuário (aplicado nas rotas protegidas)
const userRateLimit = createUserRateLimit();

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/flows', userRateLimit, flowRoutes);
app.use('/api/public-flows', publicFlowRoutes);
app.use('/api/admin', userManagementRoutes);
app.use('/api/connectors', userRateLimit, connectorRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/output', userRateLimit, outputRoutes);
app.use('/api/logs', userRateLimit, logRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/executions', userRateLimit, executionRoutes);
app.use('/api/schedules', userRateLimit, scheduleRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api', userRateLimit, flowDataRoutes);

// Middleware para rotas não encontradas
app.use(notFoundHandler);

// Middleware de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Tratamento de erros não capturados
process.on('uncaughtException', (err) => {
  console.error('Erro não capturado:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', reason);
  // Em produção, pode ser melhor fazer graceful shutdown
  process.exit(1);
});

module.exports = app;
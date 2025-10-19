const mongoose = require('mongoose');
const connectDB = require('../utils/database');
const logger = require('../utils/logger');

let isConnecting = false;
let connectionPromise = null;

/**
 * Middleware que garante conexão com MongoDB antes de processar requisições
 * Essencial para ambientes serverless onde a conexão pode não estar pronta
 */
const ensureDB = async (req, res, next) => {
  // Já conectado
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  // Se já está conectando, aguarda a mesma promise
  if (isConnecting && connectionPromise) {
    try {
      await connectionPromise;
      return next();
    } catch (err) {
      logger.error('Erro ao aguardar conexão MongoDB:', err);
      return res.status(503).json({
        success: false,
        error: {
          message: 'Banco de dados indisponível',
          code: 'DB_UNAVAILABLE',
          details: null,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // Iniciar nova conexão
  isConnecting = true;
  connectionPromise = connectDB();

  try {
    await connectionPromise;
    isConnecting = false;
    connectionPromise = null;
    return next();
  } catch (err) {
    isConnecting = false;
    connectionPromise = null;
    logger.error('Falha ao conectar MongoDB:', err);
    return res.status(503).json({
      success: false,
      error: {
        message: 'Erro ao conectar ao banco de dados',
        code: 'DB_CONNECTION_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : null,
        timestamp: new Date().toISOString()
      }
    });
  }
};

module.exports = ensureDB;

const logService = require('../services/logService');
const { formatSuccess, formatError } = require('../utils/helpers');

class LogController {
  /**
   * GET /api/logs - List log files
   */
  async listFiles(req, res) {
    try {
      const files = await logService.getLogFiles();
      return res.json(formatSuccess({ files }));
    } catch (error) {
      return res.status(500).json(formatError(error.message, 'LOG_ERROR'));
    }
  }

  /**
   * GET /api/logs/today - Get today's logs
   */
  async getTodayLogs(req, res) {
    try {
      const { limit, offset, search, level } = req.query;
      const result = await logService.getTodayLogs({
        limit: parseInt(limit) || 100,
        offset: parseInt(offset) || 0,
        search,
        level
      });
      return res.json(formatSuccess(result));
    } catch (error) {
      return res.status(500).json(formatError(error.message, 'LOG_ERROR'));
    }
  }

  /**
   * GET /api/logs/search - Search logs
   */
  async searchLogs(req, res) {
    try {
      const { query, level, startDate, endDate, limit } = req.query;

      if (!query) {
        return res.status(400).json(formatError('Query parameter is required', 'VALIDATION_ERROR'));
      }

      const logs = await logService.searchLogs(query, {
        level,
        startDate,
        endDate,
        limit: parseInt(limit) || 100
      });

      return res.json(formatSuccess({ logs, count: logs.length }));
    } catch (error) {
      return res.status(500).json(formatError(error.message, 'LOG_ERROR'));
    }
  }

  /**
   * GET /api/logs/stats - Get log statistics
   */
  async getStats(req, res) {
    try {
      const { filename } = req.query;
      const today = new Date().toISOString().split('T')[0];
      const file = filename || `flowforge-api-${today}.log`;

      const stats = await logService.getStats(file);
      return res.json(formatSuccess(stats));
    } catch (error) {
      return res.status(500).json(formatError(error.message, 'LOG_ERROR'));
    }
  }

  /**
   * GET /api/logs/download/:filename - Download log file
   */
  async downloadLog(req, res) {
    try {
      const { filename } = req.params;

      // Security: prevent path traversal
      if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json(formatError('Invalid filename', 'VALIDATION_ERROR'));
      }

      const filePath = logService.getLogFilePath(filename);
      return res.download(filePath, filename);
    } catch (error) {
      return res.status(500).json(formatError(error.message, 'LOG_ERROR'));
    }
  }
}

module.exports = new LogController();

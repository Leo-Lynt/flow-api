const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');

class LogService {
  constructor() {
    this.logsDir = path.join(__dirname, '../../logs');
  }

  /**
   * Get log files sorted by date (newest first)
   */
  async getLogFiles() {
    const files = await fs.readdir(this.logsDir);
    return files
      .filter(f => f.endsWith('.log'))
      .sort((a, b) => b.localeCompare(a));
  }

  /**
   * Read logs from a file with pagination
   */
  async readLogs(filename, options = {}) {
    const { limit = 100, offset = 0, search = '', level = null } = options;
    const filePath = path.join(this.logsDir, filename);

    if (!await fs.pathExists(filePath)) {
      throw new Error('Log file not found');
    }

    const logs = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream });

    let lineNumber = 0;
    let collected = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const log = JSON.parse(line);

        // Apply filters
        if (level && log.level !== level) continue;
        if (search && !JSON.stringify(log).toLowerCase().includes(search.toLowerCase())) continue;

        // Pagination
        if (lineNumber >= offset && collected < limit) {
          logs.push({ ...log, _line: lineNumber });
          collected++;
        }

        lineNumber++;

        if (collected >= limit) break;
      } catch (err) {
        // Skip invalid JSON lines
      }
    }

    return { logs, total: lineNumber };
  }

  /**
   * Get today's logs
   */
  async getTodayLogs(options = {}) {
    try {
      // Get the most recent log file instead of calculating date
      const files = await this.getLogFiles();
      const apiLogFiles = files.filter(f => f.startsWith('flowforge-api-') && f.endsWith('.log') && !f.includes('.log.'));

      if (apiLogFiles.length === 0) {
        throw new Error('No log files found');
      }

      // Most recent file (already sorted in getLogFiles)
      const filename = apiLogFiles[0];
      console.log('Reading most recent log file:', filename);
      return await this.readLogs(filename, options);
    } catch (error) {
      console.error('ERROR in getTodayLogs:', error);
      throw error;
    }
  }

  /**
   * Search across all log files
   */
  async searchLogs(query, options = {}) {
    const { limit = 100, level = null, startDate = null, endDate = null } = options;
    const files = await this.getLogFiles();
    const results = [];

    for (const file of files) {
      // Date filtering
      if (startDate || endDate) {
        const fileDate = this.extractDateFromFilename(file);
        if (startDate && fileDate < new Date(startDate)) continue;
        if (endDate && fileDate > new Date(endDate)) continue;
      }

      const { logs } = await this.readLogs(file, { search: query, level, limit: limit - results.length });
      results.push(...logs.map(log => ({ ...log, _file: file })));

      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }

  /**
   * Extract date from filename (flowforge-api-YYYY-MM-DD.log)
   */
  extractDateFromFilename(filename) {
    const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? new Date(match[1]) : new Date(0);
  }

  /**
   * Get log statistics
   */
  async getStats(filename) {
    const { logs } = await this.readLogs(filename, { limit: Infinity });

    const stats = {
      total: logs.length,
      byLevel: {},
      byType: {},
      errors: logs.filter(l => l.level === 'error').length,
      avgDuration: 0
    };

    logs.forEach(log => {
      // Count by level
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;

      // Count by type
      if (log.type) {
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Download logs (get file path for streaming)
   */
  getLogFilePath(filename) {
    return path.join(this.logsDir, filename);
  }
}

module.exports = new LogService();

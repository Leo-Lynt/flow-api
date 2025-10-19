const logger = require('../utils/logger');

/**
 * Serviço de análise de segurança para flows públicos
 */
class SecurityScanService {
  constructor() {
    // Padrões PERIGOSOS - indicam código malicioso
    this.DANGEROUS_PATTERNS = [
      { pattern: /eval\s*\(/gi, name: 'eval()' },
      { pattern: /Function\s*\(/gi, name: 'Function()' },
      { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/gi, name: 'child_process' },
      { pattern: /\.exec\s*\(/gi, name: '.exec()' },
      { pattern: /\.spawn\s*\(/gi, name: '.spawn()' },
      { pattern: /fs\.unlink/gi, name: 'fs.unlink' },
      { pattern: /fs\.rm/gi, name: 'fs.rm' },
      { pattern: /fs\.rmdir/gi, name: 'fs.rmdir' },
      { pattern: /process\.kill/gi, name: 'process.kill' },
      { pattern: /process\.exit/gi, name: 'process.exit' },
      { pattern: /process\.abort/gi, name: 'process.abort' }
    ];

    // Padrões SUSPEITOS - precisam revisão manual
    this.SUSPICIOUS_PATTERNS = [
      { pattern: /process\.env/gi, name: 'process.env' },
      { pattern: /\.password\s*[=:]/gi, name: 'password assignment' },
      { pattern: /\.secret\s*[=:]/gi, name: 'secret assignment' },
      { pattern: /api[_-]?key\s*[=:]/gi, name: 'API key' },
      { pattern: /access[_-]?token\s*[=:]/gi, name: 'access token' },
      { pattern: /private[_-]?key/gi, name: 'private key' },
      { pattern: /BEGIN\s+(RSA\s+)?PRIVATE\s+KEY/gi, name: 'RSA private key' },
      { pattern: /mongodb:\/\/[^:]+:[^@]+@/gi, name: 'MongoDB connection string' },
      { pattern: /postgres:\/\/[^:]+:[^@]+@/gi, name: 'PostgreSQL connection string' },
      { pattern: /mysql:\/\/[^:]+:[^@]+@/gi, name: 'MySQL connection string' },
      { pattern: /redis:\/\/[^:]+:[^@]+@/gi, name: 'Redis connection string' },
      { pattern: /fetch\s*\(/gi, name: 'fetch()' },
      { pattern: /axios\./gi, name: 'axios' },
      { pattern: /http\.request/gi, name: 'http.request' },
      { pattern: /https\.request/gi, name: 'https.request' },
      { pattern: /crypto\.createCipher/gi, name: 'crypto.createCipher' },
      { pattern: /btoa\s*\(/gi, name: 'btoa()' },
      { pattern: /atob\s*\(/gi, name: 'atob()' },
      { pattern: /Buffer\.from/gi, name: 'Buffer.from' },
      { pattern: /fs\.writeFile/gi, name: 'fs.writeFile' },
      { pattern: /fs\.appendFile/gi, name: 'fs.appendFile' }
    ];

    // Padrões de credenciais
    this.CREDENTIAL_PATTERNS = [
      { pattern: /['"][a-zA-Z0-9]{32,}['"]/g, name: 'possible API key (32+ chars)' },
      { pattern: /['"]sk_[a-zA-Z0-9_]{20,}['"]/g, name: 'Stripe secret key' },
      { pattern: /['"]pk_[a-zA-Z0-9_]{20,}['"]/g, name: 'Stripe public key' },
      { pattern: /['"]AKIA[A-Z0-9]{16}['"]/g, name: 'AWS access key' },
      { pattern: /['"]ghp_[a-zA-Z0-9]{36}['"]/g, name: 'GitHub personal token' },
      { pattern: /['"]gho_[a-zA-Z0-9]{36}['"]/g, name: 'GitHub OAuth token' },
      { pattern: /['"]ya29\.[a-zA-Z0-9_-]{68,}['"]/g, name: 'Google OAuth token' },
      { pattern: /['"]AIza[a-zA-Z0-9_-]{35}['"]/g, name: 'Google API key' }
    ];
  }

  /**
   * Analisa um flow para detectar código perigoso ou suspeito
   * @param {Object} flow - Flow a ser analisado
   * @returns {Object} Resultado da análise
   */
  async scanFlow(flow) {
    try {
      const result = {
        status: 'clean',
        warnings: [],
        detectedPatterns: [],
        hasDangerousCode: false,
        hasSuspiciousCode: false,
        hasCredentials: false
      };

      // Converter flow para string JSON para análise
      const flowContent = JSON.stringify(flow, null, 2);

      // 1. Verificar padrões PERIGOSOS
      for (const { pattern, name } of this.DANGEROUS_PATTERNS) {
        if (pattern.test(flowContent)) {
          result.hasDangerousCode = true;
          result.detectedPatterns.push(name);
          result.warnings.push(`⛔ PERIGO: Detectado uso de ${name}`);
        }
      }

      // 2. Verificar padrões SUSPEITOS
      for (const { pattern, name } of this.SUSPICIOUS_PATTERNS) {
        if (pattern.test(flowContent)) {
          result.hasSuspiciousCode = true;
          result.detectedPatterns.push(name);
          result.warnings.push(`⚠️ SUSPEITO: Detectado uso de ${name}`);
        }
      }

      // 3. Verificar CREDENCIAIS
      for (const { pattern, name } of this.CREDENTIAL_PATTERNS) {
        if (pattern.test(flowContent)) {
          result.hasCredentials = true;
          result.detectedPatterns.push(name);
          result.warnings.push(`🔑 CREDENCIAL: Detectado ${name}`);
        }
      }

      // 4. Verificar nodes específicos
      if (flow.flowDataId || flow.nodes) {
        const nodes = flow.nodes || [];

        for (const node of nodes) {
          // Verificar nodes de código customizado
          if (node.type === 'custom-code' || node.type === 'function') {
            result.warnings.push(`📝 INFO: Flow contém código customizado no node "${node.name || node.id}"`);
          }

          // Verificar nodes de API/HTTP
          if (node.type === 'http-request' || node.type === 'api-call') {
            if (node.config?.url && !node.config.url.startsWith('http')) {
              result.warnings.push(`🌐 INFO: Request HTTP detectado em "${node.name || node.id}"`);
            }
          }

          // Verificar nodes de database
          if (node.type === 'database' || node.type === 'sql') {
            result.warnings.push(`💾 INFO: Operação de banco de dados em "${node.name || node.id}"`);
          }
        }
      }

      // 5. Determinar status final
      if (result.hasDangerousCode) {
        result.status = 'dangerous';
      } else if (result.hasSuspiciousCode || result.hasCredentials) {
        result.status = 'suspicious';
      } else if (result.warnings.length > 0) {
        result.status = 'clean'; // mas com informações
      }

      logger.info(`Security scan completed for flow ${flow._id || flow.id}: ${result.status}`, {
        warnings: result.warnings.length,
        patterns: result.detectedPatterns.length
      });

      return result;
    } catch (error) {
      logger.error('Error during security scan:', error);
      throw error;
    }
  }

  /**
   * Sanitiza um flow removendo dados sensíveis antes da publicação
   * @param {Object} flow - Flow a ser sanitizado
   * @returns {Object} Flow sanitizado
   */
  async sanitizeFlowForPublication(flow) {
    try {
      const sanitized = JSON.parse(JSON.stringify(flow)); // Deep clone

      // Remover execution stats sensíveis
      if (sanitized.executionStats) {
        sanitized.executionStats = {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          lastExecutedAt: null,
          avgExecutionTime: 0
        };
      }

      // Limpar nodes
      if (sanitized.nodes) {
        sanitized.nodes = sanitized.nodes.map(node => {
          const cleanNode = { ...node };

          // Remover credenciais de nodes
          if (cleanNode.type === 'credential' || cleanNode.credentials) {
            cleanNode.credentials = null;
            if (cleanNode.config) {
              if (cleanNode.config.apiKey) cleanNode.config.apiKey = '***REMOVED***';
              if (cleanNode.config.password) cleanNode.config.password = '***REMOVED***';
              if (cleanNode.config.token) cleanNode.config.token = '***REMOVED***';
              if (cleanNode.config.secret) cleanNode.config.secret = '***REMOVED***';
            }
          }

          // Remover variáveis de ambiente
          if (cleanNode.config && cleanNode.config.env) {
            cleanNode.config.env = {};
          }

          return cleanNode;
        });
      }

      // Remover campos sensíveis do usuário
      delete sanitized.userId;

      // Manter apenas metadados necessários
      if (!sanitized.publicMetadata) {
        sanitized.publicMetadata = {};
      }

      logger.info(`Flow sanitized for publication: ${flow._id || flow.id}`);

      return sanitized;
    } catch (error) {
      logger.error('Error sanitizing flow:', error);
      throw error;
    }
  }

  /**
   * Valida se um flow está pronto para publicação
   * @param {Object} flow - Flow a ser validado
   * @returns {Object} Resultado da validação
   */
  async validateForPublication(flow) {
    const errors = [];
    const warnings = [];

    // Validações obrigatórias
    if (!flow.name || flow.name.trim().length === 0) {
      errors.push('Nome do flow é obrigatório');
    }

    if (!flow.description || flow.description.trim().length < 20) {
      errors.push('Descrição deve ter pelo menos 20 caracteres');
    }

    if (!flow.category) {
      errors.push('Categoria é obrigatória');
    }

    if (!flow.publicMetadata?.detailedDescription || flow.publicMetadata.detailedDescription.trim().length < 50) {
      errors.push('Descrição detalhada deve ter pelo menos 50 caracteres');
    }

    if (!flow.publicMetadata?.tags || flow.publicMetadata.tags.length === 0) {
      warnings.push('Adicione tags para facilitar a busca do seu flow');
    }

    if (flow.publicMetadata?.tags && flow.publicMetadata.tags.length > 10) {
      errors.push('Máximo de 10 tags permitidas');
    }

    // Verificar se flow tem nodes
    const nodeCount = flow.nodes?.length || flow.totalNodes || 0;
    if (nodeCount === 0) {
      errors.push('Flow deve ter pelo menos 1 node');
    }

    // Verificar licença
    const validLicenses = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'All-Rights-Reserved'];
    if (flow.publicMetadata?.license && !validLicenses.includes(flow.publicMetadata.license)) {
      errors.push('Licença inválida');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = new SecurityScanService();

const connectorService = require('../services/connectorService');
const { formatError, formatSuccess } = require('../utils/helpers');
const { NodeDataSource } = require('../adapters/NodeDataSource');

/**
 * ✅ AGORA IMPORTA DO CORE usando dynamic import
 */
let mapSourceTypeFromApi = null;

/**
 * Carrega função de mapeamento do Core usando dynamic import
 */
async function loadMappingFunction() {
  if (!mapSourceTypeFromApi) {
    try {
      const mappings = await import('@flow-forge/core/config/mappings.js');
      mapSourceTypeFromApi = mappings.mapSourceTypeFromApi;
    } catch (error) {
      console.error('❌ Erro ao carregar mappings do Core:', error);
      throw error;
    }
  }
  return mapSourceTypeFromApi;
}

class ConnectorController {
  async executeConnector(req, res) {
    const startTime = Date.now();

    try {
      const { sourceType, config, temporalConfig, transformations } = req.body;
      const userId = req.user.userId;

      // Mapear sourceType da API para formato canônico (sheets → google_sheets)
      // Agora importa do Core dinamicamente
      const mapFunc = await loadMappingFunction();
      const canonicalSourceType = mapFunc(sourceType);

      // Transformar config canônico para formato de serviço
      // O frontend envia config normalizado (spreadsheetUrl), mas os adapters esperam formato de serviço (url)
      const nodeDataSource = new NodeDataSource(canonicalSourceType);
      const serviceConfig = await nodeDataSource.transformConfig(config);

      // Executar conector
      const result = await connectorService.execute({
        sourceType,
        config: serviceConfig,
        temporalConfig,
        transformations,
        userId
      });

      const executionTime = Date.now() - startTime;

      return res.status(200).json(formatSuccess({
        result: {
          data: result.data,
          metadata: result.metadata
        },
        performance: {
          executionTime,
          fromCache: result.fromCache || false
        }
      }, 'Dados obtidos com sucesso'));

    } catch (error) {
      console.error('Erro ao executar conector:', error);

      // Erros conhecidos
      if (error.message.includes('Tipo de fonte não suportado')) {
        return res.status(400).json(formatError(error.message, 'INVALID_SOURCE_TYPE'));
      }

      if (error.message.includes('timeout')) {
        return res.status(504).json(formatError('Timeout ao buscar dados', 'TIMEOUT'));
      }

      if (error.message.includes('autenticação')) {
        return res.status(401).json(formatError('Erro de autenticação com a fonte', 'AUTH_ERROR'));
      }

      return res.status(500).json(formatError('Erro ao buscar dados', 'CONNECTOR_ERROR', {
        details: error.message
      }));
    }
  }
}

module.exports = new ConnectorController();
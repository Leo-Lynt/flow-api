/**
 * NodeDataSource Adapter (Backend/API)
 * Implementa IDataSource usando services locais do Node.js
 *
 * ✅ AGORA IMPORTA TUDO DO CORE usando dynamic import (CommonJS + ES Modules)
 */

const AdapterFactory = require('../services/connectors/AdapterFactory');

/**
 * Cache para IDataSource importado do Core (opcional, usado para validação)
 */
let IDataSourceClass = null;

/**
 * Carrega IDataSource do Core usando dynamic import (opcional)
 */
async function loadIDataSource() {
  if (!IDataSourceClass) {
    try {
      const coreInterfaces = await import('@flow-forge/core/interfaces/IDataSource.js');
      IDataSourceClass = coreInterfaces.IDataSource;
    } catch (error) {
      console.warn('⚠️ Não foi possível carregar IDataSource do Core (opcional):', error.message);
      return null;
    }
  }
  return IDataSourceClass;
}

/**
 * Cache para mapeamentos importados do Core
 * Carregados sob demanda via dynamic import
 */
let CANONICAL_TO_SERVICE_FIELDS = null;
let SOURCE_TYPE_MAPPINGS = null;

/**
 * Carrega mapeamentos do Core usando dynamic import
 * CommonJS pode importar ES Modules assincronamente
 */
async function loadMappingsFromCore() {
  if (!CANONICAL_TO_SERVICE_FIELDS) {
    try {
      const mappings = await import('@flow-forge/core/config/mappings.js');
      CANONICAL_TO_SERVICE_FIELDS = mappings.CANONICAL_TO_SERVICE;
      SOURCE_TYPE_MAPPINGS = mappings.SOURCE_TYPE_MAPPINGS;
    } catch (error) {
      console.error('❌ Erro ao carregar mappings do Core:', error);
      throw error;
    }
  }
  return { CANONICAL_TO_SERVICE_FIELDS, SOURCE_TYPE_MAPPINGS };
}

/**
 * NodeDataSource implementa IDataSource
 * Nota: Não estende diretamente pois IDataSource é carregado dinamicamente
 * Implementa os mesmos métodos da interface
 */
class NodeDataSource {
  constructor(sourceType) {
    this.sourceType = sourceType;
    this.adapterFactory = new AdapterFactory();
  }

  /**
   * Transforma config canônico para formato esperado pelo service
   * Agora carrega mapeamentos do Core dinamicamente
   */
  async transformConfig(canonicalConfig) {
    const { CANONICAL_TO_SERVICE_FIELDS } = await loadMappingsFromCore();

    const mapping = CANONICAL_TO_SERVICE_FIELDS[this.sourceType];
    if (!mapping) {
      // Se não tem mapeamento, retorna como está
      return canonicalConfig;
    }

    const serviceConfig = {};
    for (const [canonicalField, serviceField] of Object.entries(mapping)) {
      if (canonicalConfig[canonicalField] !== undefined) {
        serviceConfig[serviceField] = canonicalConfig[canonicalField];
      }
    }

    return serviceConfig;
  }

  /**
   * Busca dados usando adapter local
   * @param {Object} config - Configuração canônica (do core)
   * @param {Object} context - Contexto com userId, etc
   */
  async fetch(config, context) {
    const { SOURCE_TYPE_MAPPINGS } = await loadMappingsFromCore();
    const serviceType = SOURCE_TYPE_MAPPINGS.toApi[this.sourceType];

    if (!serviceType) {
      throw new Error(`No service mapping found for source type: ${this.sourceType}`);
    }

    try {
      // Obter adapter do factory
      const adapter = this.adapterFactory.getAdapter(serviceType);

      // Transformar config canônico para formato do serviço (agora async)
      const serviceConfig = await this.transformConfig(config);

      // Executar fetch
      // Os adapters atuais esperam: fetch(config, resolvedDates, userId)
      const result = await adapter.fetch(
        serviceConfig,
        {}, // resolvedDates - pode ser expandido depois
        context.userId
      );

      return result;
    } catch (error) {
      console.error(`❌ NodeDataSource fetch error (${this.sourceType}):`, error.message);
      throw error;
    }
  }

  /**
   * Valida configuração
   * No backend, a validação canônica já foi feita pelo core
   */
  validate(config) {
    return { valid: true, errors: [] };
  }

  /**
   * Retorna tipo de fonte
   */
  getSourceType() {
    return this.sourceType;
  }
}

/**
 * Factory para criar NodeDataSource por tipo
 */
class NodeDataSourceFactory {
  static create(sourceType) {
    return new NodeDataSource(sourceType);
  }

  /**
   * Cria todos os adapters disponíveis
   * Agora carrega sourceTypes do Core
   */
  static async createAll() {
    const { SOURCE_TYPE_MAPPINGS } = await loadMappingsFromCore();
    const sourceTypes = Object.keys(SOURCE_TYPE_MAPPINGS.toApi);

    return sourceTypes.map(type => ({
      type,
      adapter: NodeDataSourceFactory.create(type)
    }));
  }
}

module.exports = {
  NodeDataSource,
  NodeDataSourceFactory
};

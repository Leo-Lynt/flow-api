/**
 * API Cache Setup
 *
 * Inicializa CacheManager com MemoryStorageAdapter (ou RedisAdapter em produção)
 */

let CacheManager, ExecutionStateManager, MemoryStorageAdapter;
let cacheManagerInstance = null;
let executionStateManagerInstance = null;

/**
 * Carrega módulos ESM do core (lazy loading)
 */
async function loadCoreModules() {
  if (!CacheManager) {
    const core = await import('@flow-forge/core/engine/index.js');
    CacheManager = core.CacheManager;
    ExecutionStateManager = core.ExecutionStateManager;
    MemoryStorageAdapter = core.MemoryStorageAdapter;
  }
}

/**
 * Inicializa e retorna o CacheManager
 * @param {Object} config - Configuração opcional para Redis
 */
async function getCacheManager(config = {}) {
  await loadCoreModules();

  if (!cacheManagerInstance) {
    try {
      // Se config.redis está presente, usar RedisAdapter
      if (config.redis && config.redis.enabled) {
        const { createRedisAdapter } = await import('@flow-forge/core/engine/index.js');

        const redisAdapter = await createRedisAdapter({
          host: config.redis.host || process.env.REDIS_HOST || 'localhost',
          port: config.redis.port || process.env.REDIS_PORT || 6379,
          password: config.redis.password || process.env.REDIS_PASSWORD,
          db: config.redis.db || 0,
          prefix: 'flowforge-api'
        });

        cacheManagerInstance = new CacheManager(redisAdapter);
        console.log('✅ CacheManager initialized with RedisAdapter');
      } else {
        // Fallback para MemoryStorageAdapter
        const memoryAdapter = new MemoryStorageAdapter();
        cacheManagerInstance = new CacheManager(memoryAdapter);
        console.log('✅ CacheManager initialized with MemoryStorageAdapter');
      }
    } catch (error) {
      console.error('❌ Failed to initialize CacheManager:', error);

      // Fallback final para MemoryStorageAdapter
      const memoryAdapter = new MemoryStorageAdapter();
      cacheManagerInstance = new CacheManager(memoryAdapter);
      console.warn('⚠️ Using MemoryStorageAdapter as fallback');
    }
  }

  return cacheManagerInstance;
}

/**
 * Inicializa e retorna o ExecutionStateManager
 */
async function getExecutionStateManager() {
  await loadCoreModules();

  if (!executionStateManagerInstance) {
    const cache = await getCacheManager();
    executionStateManagerInstance = new ExecutionStateManager(cache);
    console.log('✅ ExecutionStateManager initialized');
  }

  return executionStateManagerInstance;
}

/**
 * Cache helpers específicos para a API
 */

/**
 * Cache de resultados de connectors
 */
async function cacheConnectorResult(connectorId, params, result) {
  const cache = await getCacheManager();
  const key = `${connectorId}:${JSON.stringify(params)}`;

  await cache.set(key, result, {
    namespace: 'connector-results',
    ttl: 300000 // 5 minutos
  });
}

async function getCachedConnectorResult(connectorId, params) {
  const cache = await getCacheManager();
  const key = `${connectorId}:${JSON.stringify(params)}`;

  return await cache.get(key, {
    namespace: 'connector-results'
  });
}

async function clearConnectorCache() {
  const cache = await getCacheManager();
  return await cache.clear({ namespace: 'connector-results' });
}

/**
 * Cache de autenticação/tokens
 */
async function cacheAuthToken(userId, token, expiresIn) {
  const cache = await getCacheManager();

  await cache.set(userId, token, {
    namespace: 'auth-tokens',
    ttl: expiresIn
  });
}

async function getCachedAuthToken(userId) {
  const cache = await getCacheManager();

  return await cache.get(userId, {
    namespace: 'auth-tokens'
  });
}

async function invalidateAuthToken(userId) {
  const cache = await getCacheManager();

  return await cache.delete(userId, {
    namespace: 'auth-tokens'
  });
}

/**
 * Cache de flows compilados
 */
async function cacheCompiledFlow(flowId, compiledData) {
  const cache = await getCacheManager();

  await cache.set(flowId, compiledData, {
    namespace: 'compiled-flows',
    ttl: 1800000 // 30 minutos
  });
}

async function getCachedCompiledFlow(flowId) {
  const cache = await getCacheManager();

  return await cache.get(flowId, {
    namespace: 'compiled-flows'
  });
}

async function invalidateCompiledFlow(flowId) {
  const cache = await getCacheManager();

  return await cache.delete(flowId, {
    namespace: 'compiled-flows'
  });
}

/**
 * Cache de node catalog
 */
async function cacheNodeCatalog(catalog) {
  const cache = await getCacheManager();

  await cache.set('catalog', catalog, {
    namespace: 'node-catalog',
    ttl: 3600000 // 1 hora
  });
}

async function getCachedNodeCatalog() {
  const cache = await getCacheManager();

  return await cache.get('catalog', {
    namespace: 'node-catalog'
  });
}

/**
 * Limpa todo o cache da API
 */
async function clearAllCache() {
  const cache = await getCacheManager();
  return await cache.clear();
}

/**
 * Obtém estatísticas do cache
 */
async function getCacheStats() {
  const cache = await getCacheManager();
  return await cache.stats();
}

/**
 * Cleanup de execuções antigas (executar periodicamente)
 */
async function cleanupOldExecutions(olderThanMs = 86400000) {
  const stateManager = await getExecutionStateManager();
  return await stateManager.cleanupOldExecutions(olderThanMs);
}

module.exports = {
  getCacheManager,
  getExecutionStateManager,
  cacheConnectorResult,
  getCachedConnectorResult,
  clearConnectorCache,
  cacheAuthToken,
  getCachedAuthToken,
  invalidateAuthToken,
  cacheCompiledFlow,
  getCachedCompiledFlow,
  invalidateCompiledFlow,
  cacheNodeCatalog,
  getCachedNodeCatalog,
  clearAllCache,
  getCacheStats,
  cleanupOldExecutions
};

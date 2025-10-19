const { LRUCache } = require('lru-cache');
const zlib = require('zlib');
const FlowCacheEntry = require('../models/FlowCacheEntry');

class IntelligentCache {
  constructor() {
    // L1: Memória (rápido, limitado a 500MB)
    this.memory = new LRUCache({
      maxSize: 500 * 1024 * 1024, // 500MB

      sizeCalculation: (value) => {
        return value.size || 0;
      },

      ttl: 1000 * 60 * 60, // 1 hora

      updateAgeOnGet: true, // Mais usado fica mais tempo

      dispose: (value, key, reason) => {
        if (reason === 'evict') {
          console.log(`♻️  Evicted from L1 cache: ${key} (${(value.size / 1024).toFixed(2)} KB)`);
        }
      }
    });

    // Stats
    this.stats = {
      l1Hits: 0,
      l2Hits: 0,
      misses: 0,
      sets: 0
    };
  }

  /**
   * Gera chave de cache
   */
  _getCacheKey(flowId, nodeId) {
    return `${flowId}:${nodeId}`;
  }

  /**
   * Buscar resultado cacheado
   * @param {string} flowId - ID do flow
   * @param {string} nodeId - ID do node
   * @param {string} expectedHash - Hash esperado (para validação)
   * @param {Object} expectedUpstreamHashes - Hashes upstream esperados
   * @returns {Promise<any|null>} Resultado cacheado ou null
   */
  async get(flowId, nodeId, expectedHash, expectedUpstreamHashes = {}) {
    const key = this._getCacheKey(flowId, nodeId);

    // L1: Verificar memória
    let cached = this.memory.get(key);
    console.log(`🔎 L1 lookup for ${key}: ${cached ? 'FOUND' : 'NOT FOUND'}`);
    if (cached && this._isValidCache(cached, expectedHash, expectedUpstreamHashes)) {
      this.stats.l1Hits++;
      console.log(`✅ L1 Cache HIT: ${key}`);
      return cached.result;
    }

    // L2: Verificar MongoDB
    try {
      const dbEntry = await FlowCacheEntry.findOne({ flowId, nodeId });

      if (dbEntry && this._isValidDbCache(dbEntry, expectedHash, expectedUpstreamHashes)) {
        this.stats.l2Hits++;
        console.log(`✅ L2 Cache HIT: ${key}`);

        // Descomprimir resultado
        const decompressed = zlib.gunzipSync(dbEntry.resultCompressed);
        const result = JSON.parse(decompressed.toString());

        // Promover para L1
        this.memory.set(key, {
          hash: dbEntry.hash,
          upstreamHashes: Object.fromEntries(dbEntry.upstreamHashes),
          result,
          size: dbEntry.size,
          timestamp: Date.now()
        });

        return result;
      }
    } catch (err) {
      console.error(`❌ Error reading L2 cache: ${err.message}`);
    }

    // Cache miss
    this.stats.misses++;
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  /**
   * Salvar resultado no cache
   * @param {string} flowId - ID do flow
   * @param {string} nodeId - ID do node
   * @param {string} hash - Hash da configuração
   * @param {Object} upstreamHashes - Hashes dos nodes upstream
   * @param {any} result - Resultado para cachear
   */
  async set(flowId, nodeId, hash, upstreamHashes, result) {
    const key = this._getCacheKey(flowId, nodeId);
    const json = JSON.stringify(result);
    const size = json.length;

    this.stats.sets++;

    // L1: Guardar em memória
    this.memory.set(key, {
      hash,
      upstreamHashes,
      result,
      size,
      timestamp: Date.now()
    });

    console.log(`💾 Cached in L1: ${key} (${(size / 1024).toFixed(2)} KB)`);

    // L2: Comprimir e salvar no MongoDB (async, não bloqueia)
    setImmediate(async () => {
      try {
        const compressed = zlib.gzipSync(json);
        const compressionRatio = (compressed.length / size * 100).toFixed(1);

        await FlowCacheEntry.findOneAndUpdate(
          { flowId, nodeId },
          {
            hash,
            upstreamHashes: new Map(Object.entries(upstreamHashes)),
            resultCompressed: compressed,
            size,
            timestamp: new Date()
          },
          { upsert: true }
        );

        console.log(`💾 Cached in L2: ${key} (${(size / 1024).toFixed(2)} KB → ${(compressed.length / 1024).toFixed(2)} KB, ${compressionRatio}% compression)`);
      } catch (err) {
        console.error(`❌ Failed to save L2 cache: ${err.message}`);
      }
    });
  }

  /**
   * Verificar se cache em memória é válido
   */
  _isValidCache(cached, expectedHash, expectedUpstreamHashes) {
    // Verificar hash do próprio node
    console.log(`🔍 Validating cache: cached=${cached.hash?.substring(0, 8)}, expected=${expectedHash?.substring(0, 8)}`);

    if (cached.hash !== expectedHash) {
      console.log(`🔄 Cache invalid: node config changed (cached: ${cached.hash?.substring(0, 8)}, expected: ${expectedHash?.substring(0, 8)})`);
      return false;
    }

    // Verificar hashes upstream
    const cachedUpstream = cached.upstreamHashes || {};
    for (const [upstreamId, upstreamHash] of Object.entries(expectedUpstreamHashes)) {
      if (cachedUpstream[upstreamId] !== upstreamHash) {
        console.log(`🔄 Cache invalid: upstream node ${upstreamId} changed`);
        return false;
      }
    }

    console.log(`✅ Cache validation passed`);
    return true;
  }

  /**
   * Verificar se cache do MongoDB é válido
   */
  _isValidDbCache(dbEntry, expectedHash, expectedUpstreamHashes) {
    // Verificar hash do próprio node
    if (dbEntry.hash !== expectedHash) {
      return false;
    }

    // Verificar hashes upstream
    const cachedUpstream = Object.fromEntries(dbEntry.upstreamHashes);
    for (const [upstreamId, upstreamHash] of Object.entries(expectedUpstreamHashes)) {
      if (cachedUpstream[upstreamId] !== upstreamHash) {
        return false;
      }
    }

    return true;
  }

  /**
   * Limpar cache de um flow específico
   */
  async clearFlowCache(flowId) {
    // L1: Remover da memória
    const keys = Array.from(this.memory.keys());
    const flowKeys = keys.filter(k => k.startsWith(`${flowId}:`));

    flowKeys.forEach(key => this.memory.delete(key));

    // L2: Remover do MongoDB
    await FlowCacheEntry.deleteMany({ flowId });

    console.log(`🗑️  Cleared cache for flow ${flowId} (${flowKeys.length} entries)`);
  }

  /**
   * Limpar todo o cache
   */
  async clearAll() {
    // L1
    this.memory.clear();

    // L2
    await FlowCacheEntry.deleteMany({});

    console.log(`🗑️  Cleared all cache`);
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    const total = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
    const hitRate = total > 0
      ? ((this.stats.l1Hits + this.stats.l2Hits) / total * 100).toFixed(1)
      : 0;

    return {
      l1Hits: this.stats.l1Hits,
      l2Hits: this.stats.l2Hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      total,
      hitRate: `${hitRate}%`,
      memorySize: this.memory.calculatedSize,
      memoryKeys: this.memory.size,
      memorySizeMB: (this.memory.calculatedSize / 1024 / 1024).toFixed(2)
    };
  }
}

// Singleton
module.exports = new IntelligentCache();

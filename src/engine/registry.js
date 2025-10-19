const fs = require('fs').promises;
const path = require('path');

/**
 * Server Node Registry
 * Carrega catálogo de nodes e gerencia métodos de execução
 */
class ServerNodeRegistry {
  constructor() {
    this.nodes = new Map();
    this.categories = new Map();
    this.methodCache = new Map();
    // Ler nodes.json do Core (source of truth)
    this.catalogPath = path.join(__dirname, '../../../core/src/config/nodes.json');
    this.catalogLoaded = false;
  }

  /**
   * Carregar catálogo de nodes
   * @returns {Promise<Object>} Catálogo carregado
   */
  async loadCatalog() {
    if (this.catalogLoaded) {
      return { nodes: this.nodes, categories: this.categories };
    }

    try {
      const catalogData = await fs.readFile(this.catalogPath, 'utf8');
      const catalog = JSON.parse(catalogData);

      // Registrar categorias
      if (catalog.categories) {
        catalog.categories.forEach(category => {
          this.categories.set(category.id, category);
        });
      }

      // Registrar nodes
      catalog.nodes.forEach(node => {
        this.nodes.set(node.type, node);
      });

      this.catalogLoaded = true;

      console.log(`✅ Node catalog loaded: ${this.nodes.size} node types, ${this.categories.size} categories`);

      return { nodes: this.nodes, categories: this.categories };

    } catch (error) {
      console.error('❌ Error loading node catalog:', error);
      throw new Error(`Failed to load node catalog: ${error.message}`);
    }
  }

  /**
   * Buscar definição de node
   * @param {string} type - Tipo do node
   * @returns {Object|null} Definição do node
   */
  getNodeDefinition(type) {
    return this.nodes.get(type) || null;
  }

  /**
   * Verificar se node type existe
   * @param {string} type - Tipo do node
   * @returns {boolean}
   */
  hasNode(type) {
    return this.nodes.has(type);
  }

  /**
   * Carregar e cachear função de execução
   * @param {string} type - Tipo do node
   * @param {string} functionType - Tipo de função ('method' ou 'validator')
   * @returns {Promise<Function|null>} Função carregada
   */
  async getNodeFunction(type, functionType = 'method') {
    const definition = this.getNodeDefinition(type);
    if (!definition) {
      console.warn(`⚠️  Node definition not found: ${type}`);
      return null;
    }

    const methodPath = definition[functionType];
    if (!methodPath) {
      console.warn(`⚠️  ${functionType} path not defined for node: ${type}`);
      return null;
    }

    // Verificar cache
    const cacheKey = `${type}:${functionType}`;
    if (this.methodCache.has(cacheKey)) {
      return this.methodCache.get(cacheKey);
    }

    try {
      // Parse: "lib/methods/processors/arrayFilter.js:execute"
      const [modulePath, functionName] = methodPath.split(':');

      let module;
      let loadedFrom = '';

      // Carregar do @flow-forge/core usando dynamic import (ES Modules)
      try {
        const coreModulePath = modulePath.replace('lib/methods/', '@flow-forge/core/src/methods/');
        module = await import(coreModulePath);
        loadedFrom = 'core';
      } catch (coreErr) {
        throw new Error(`Module not found in core: ${modulePath}\nCore error: ${coreErr.message}`);
      }

      // ES Modules retornam namespace object, acessar função exportada
      const func = module[functionName];
      if (!func) {
        // Debug: mostrar o que está disponível no módulo
        const availableExports = Object.keys(module).join(', ');
        throw new Error(`Function "${functionName}" not found in module "${modulePath}". Available exports: ${availableExports}`);
      }

      if (typeof func !== 'function') {
        throw new Error(`"${functionName}" in module "${modulePath}" is not a function (type: ${typeof func})`);
      }

      // Cachear função
      this.methodCache.set(cacheKey, func);

      console.log(`✅ Loaded ${type}.${functionType} from ${loadedFrom}`);

      return func;

    } catch (error) {
      console.error(`❌ Error loading function for ${type}:`, error.message);
      throw error; // Propagar erro para melhor debugging
    }
  }

  /**
   * Retorna todos os nodes registrados
   * @returns {Array} Array de definições
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Retorna nodes por categoria
   * @param {string} categoryId - ID da categoria
   * @returns {Array} Array de nodes
   */
  getNodesByCategory(categoryId) {
    return this.getAllNodes().filter(node => node.category === categoryId);
  }

  /**
   * Retorna todas as categorias
   * @returns {Array} Array de categorias
   */
  getAllCategories() {
    return Array.from(this.categories.values());
  }

  /**
   * Limpar cache e registry
   */
  clear() {
    this.nodes.clear();
    this.categories.clear();
    this.methodCache.clear();
    this.catalogLoaded = false;
  }

  /**
   * Estatísticas do registry
   * @returns {Object}
   */
  getStats() {
    return {
      totalNodes: this.nodes.size,
      totalCategories: this.categories.size,
      cachedMethods: this.methodCache.size,
      catalogLoaded: this.catalogLoaded
    };
  }
}

// Singleton instance
const registry = new ServerNodeRegistry();

module.exports = registry;

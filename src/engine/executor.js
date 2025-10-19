/**
 * API Executor Wrapper
 *
 * Este wrapper injeta o registry da API no core executor.
 * Toda a lógica de execução vem do @flow-forge/core/engine/nodeExecutor
 *
 * Dependency Injection Pattern:
 * - Core define a lógica pura (ESM)
 * - API injeta registry específico via context (CommonJS)
 */

const registry = require('./registry');

// Dynamic import do core executor (ESM module)
let coreExecutor = null;

/**
 * Carrega o core executor (ESM) de forma assíncrona
 * @returns {Promise<Object>} Core executor module
 */
async function loadCoreExecutor() {
  if (!coreExecutor) {
    coreExecutor = await import('@flow-forge/core/engine/nodeExecutor.js');
  }
  return coreExecutor;
}

/**
 * Registry wrapper para injeção no core
 */
const apiRegistry = {
  getNodeDefinition: (type) => registry.getNodeDefinition(type),
  getNodeFunction: (type, functionType) => registry.getNodeFunction(type, functionType)
};

/**
 * Executa um node individual usando o core executor
 * Injeta o registry da API via context
 *
 * @param {Object} node - Instância do node
 * @param {Object} nodeData - Dados de configuração
 * @param {Object} inputs - Inputs de dados
 * @param {Object} context - Contexto de execução
 * @returns {Promise<any>} Resultado da execução
 */
async function executeNode(node, nodeData, inputs, context = {}) {
  const executor = await loadCoreExecutor();

  // Injetar registry da API no context
  const contextWithRegistry = {
    ...context,
    registry: apiRegistry
  };

  // Delegar para core executor
  return executor.executeNode(node, nodeData, inputs, contextWithRegistry);
}

/**
 * Extrai os outputs de um node após execução
 * Delega para core executor
 */
async function extractOutputs(node, result) {
  const executor = await loadCoreExecutor();
  return executor.extractOutputs(node, result, { registry: apiRegistry });
}

/**
 * Valida a configuração de um node antes da execução
 * Delega para core executor
 */
async function validateNodeExecution(node, nodeData) {
  const executor = await loadCoreExecutor();
  return executor.validateNodeExecution(node, nodeData, { registry: apiRegistry });
}

/**
 * Verifica se um node tem todos os inputs obrigatórios
 * Delega para core executor
 */
async function hasRequiredInputs(node, inputs) {
  const executor = await loadCoreExecutor();
  return executor.hasRequiredInputs(node, inputs, { registry: apiRegistry });
}

/**
 * Determina o modo de execução de um node
 * Delega para core executor
 */
async function getExecutionMode(nodeType) {
  const executor = await loadCoreExecutor();
  return executor.getExecutionMode(nodeType, { registry: apiRegistry });
}

/**
 * Verifica se um node deve auto-executar quando inputs mudam
 * Delega para core executor
 */
async function shouldAutoExecute(nodeType) {
  const executor = await loadCoreExecutor();
  return executor.shouldAutoExecute(nodeType, { registry: apiRegistry });
}

/**
 * Exporta utilitários do core para compatibilidade
 */
async function getUtils() {
  const executor = await loadCoreExecutor();
  return executor.utils;
}

// Exportar funções principais
module.exports = {
  executeNode,
  extractOutputs,
  validateNodeExecution,
  hasRequiredInputs,
  getExecutionMode,
  shouldAutoExecute,
  getUtils
};

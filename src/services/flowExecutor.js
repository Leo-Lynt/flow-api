const Flow = require('../models/Flow');
const FlowExecution = require('../models/FlowExecution');
const registry = require('../engine/registry');
const { AdapterRegistry } = require('../engine/AdapterRegistry.js');
const { NodeDataSourceFactory } = require('../adapters/NodeDataSource.js');

// Importar executeFlow do Core (ESM -> CommonJS)
let coreExecuteFlow = null;
const loadCoreExecutor = async () => {
  if (!coreExecuteFlow) {
    const coreModule = await import('@flow-forge/core/src/engine/flowExecutor.js');
    coreExecuteFlow = coreModule.executeFlow;
  }
  return coreExecuteFlow;
};

/**
 * Atualizar estatísticas do Flow
 * @param {string} flowId - ID do flow
 * @param {boolean} success - Se execução foi bem sucedida
 * @param {number} executionTime - Tempo de execução em ms
 */
async function updateFlowStats(flowId, success, executionTime) {
  try {
    const flow = await Flow.findById(flowId);
    if (!flow) return;

    if (!flow.executionStats) {
      flow.executionStats = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0
      };
    }

    flow.executionStats.totalExecutions++;
    if (success) {
      flow.executionStats.successfulExecutions++;
    } else {
      flow.executionStats.failedExecutions++;
    }

    // Recalcular média de tempo
    const total = flow.executionStats.totalExecutions;
    const oldAvg = flow.executionStats.avgExecutionTime || 0;
    flow.executionStats.avgExecutionTime = ((oldAvg * (total - 1)) + executionTime) / total;

    flow.executionStats.lastExecutedAt = new Date();

    await flow.save();
  } catch (error) {
    console.warn('⚠️  Could not update flow stats:', error.message);
  }
}

class FlowExecutor {
  constructor() {
    this.initialized = false;
  }

  /**
   * Inicializar registry (carregar catálogo)
   */
  async initialize() {
    if (!this.initialized) {
      await registry.loadCatalog();
      this.initialized = true;
    }
  }

  /**
   * Valida inputs obrigatórios antes da execução
   * @param {Object} flow - Flow object com flowData
   * @param {Object} inputData - Dados de entrada fornecidos pelo usuário
   * @returns {Object} { valid: boolean, missingInputs: Array }
   */
  validateRequiredInputs(flow, inputData) {
    const { nodes, nodeData = {} } = flow.flowData;
    const missingInputs = [];

    // Encontrar todos os input nodes
    const inputNodes = nodes.filter(n => n.type === 'input');

    inputNodes.forEach(node => {
      const data = nodeData[node.id] || {};
      const parameters = data.parameters || [];

      parameters.forEach(param => {
        if (param.required) {
          const value = inputData[param.name];

          // Verificar se o valor está faltando (undefined, null, ou string vazia)
          if (value === undefined || value === null || value === '') {
            missingInputs.push({
              parameterName: param.name,
              parameterType: param.type,
              defaultValue: param.defaultValue,
              description: param.description,
              nodeId: node.id,
              nodeName: data.label || 'Input'
            });
          }
        }
      });
    });

    return {
      valid: missingInputs.length === 0,
      missingInputs
    };
  }

  /**
   * Executar fluxo completo usando Core executor
   * @param {Object} flow - Flow object com flowData
   * @param {Object} inputData - Dados de entrada
   * @param {string} userId - ID do usuário executando
   * @returns {Promise<Object>} Resultado da execução
   */
  async executeFlow(flow, inputData = {}, userId = null, triggeredBy = 'manual', scheduleId = null) {
    const flowId = flow._id.toString();
    let execution = null;

    try {
      // Garantir que registry está carregado
      await this.initialize();

      // Validar inputs obrigatórios
      const validation = this.validateRequiredInputs(flow, inputData);
      if (!validation.valid) {
        const error = new Error('Required inputs are missing');
        error.code = 'MISSING_REQUIRED_INPUTS';
        error.missingInputs = validation.missingInputs;
        throw error;
      }

      // Criar registro de execução
      execution = await FlowExecution.create({
        flowId: flow._id,
        flowName: flow.name,
        userId: userId || flow.userId,
        status: 'running',
        startedAt: new Date(),
        flowSnapshot: {
          totalNodes: flow.flowData.nodes.length,
          nodes: flow.flowData.nodes.map(n => ({
            nodeId: n.id,
            type: n.type,
            name: flow.flowData.nodeData?.[n.id]?.name || n.type
          }))
        },
        logs: [],
        cacheStats: { hits: 0, misses: 0 },
        inputData,
        triggeredBy,
        scheduleId
      });

      // Executar fluxo usando Core
      const result = await this.executeFlowInternal(flow, inputData, execution);

      // Atualizar execução com sucesso
      execution.status = 'success';
      execution.completedAt = new Date();
      execution.executionTime = execution.completedAt - execution.startedAt;
      execution.outputData = result.outputData;
      execution.nodesExecuted = result.executedNodes.length;
      execution.cacheStats = {
        hits: 0,
        misses: 0
      };
      await execution.save();

      // Atualizar stats do Flow
      await updateFlowStats(flowId, true, execution.executionTime);

      return result;

    } catch (error) {
      console.error('❌ Flow execution error:', error);

      // Atualizar execução com falha
      if (execution) {
        execution.status = 'failed';
        execution.completedAt = new Date();
        execution.executionTime = execution.completedAt - execution.startedAt;
        execution.logs.push({
          nodeId: 'global',
          nodeName: 'Flow',
          status: 'failed',
          error: error.message,
          stackTrace: error.stack,
          timestamp: new Date()
        });
        await execution.save();

        await updateFlowStats(flowId, false, execution.executionTime);
      }

      throw error;
    }
  }

  /**
   * Lógica interna de execução usando Core executor
   * @param {Object} flow - Flow object
   * @param {Object} inputData - Dados de entrada
   * @param {Object} execution - Registro de execução
   * @returns {Promise<Object>} Resultado
   */
  async executeFlowInternal(flow, inputData, execution) {
    const { nodes, edges, nodeData = {}, globalVariables = {} } = flow.flowData;

    console.log('🚀 Using Core executor...');

    // Carregar Core executor
    const coreExecutor = await loadCoreExecutor();

    // Initialize adapter registry with Node adapters
    const adapters = new AdapterRegistry();
    const nodeAdapters = await NodeDataSourceFactory.createAll();
    nodeAdapters.forEach(({ type, adapter }) => {
      adapters.registerDataSource(type, adapter);
    });

    // Construir nodeDataMap
    const nodeDataMap = {};
    nodes.forEach(node => {
      nodeDataMap[node.id] = nodeData[node.id] || {};
    });

    // Importar executeNode do engine local
    const { executeNode } = require('../engine/executor');

    // Context para o Core
    // IMPORTANTE: Passar globalVariables SEM spread para permitir modificações
    const context = {
      executeNode,  // Injetar executeNode
      adapters,
      globalVariables: globalVariables,  // SEM spread! Permitir modificações
      inputData: inputData || {},
      inputValues: inputData || {}
    };

    // Executar usando Core
    const coreResult = await coreExecutor({
      nodes,
      edges,
      nodeDataMap,
      inputData,
      context
    });

    // Determinar output final
    const outputData = this.determineFinalOutput(coreResult.results, nodes);

    // Retornar no formato esperado pelo backend (incluindo globalVariables atualizadas)
    return {
      success: true,
      outputData,
      nodeResults: coreResult.results,
      executedNodes: coreResult.executedNodes,
      globalVariables: coreResult.globalVariables,  // Retornar globalVariables atualizadas
      executionTime: 0, // Será calculado pelo caller
      cacheStats: { hits: 0, misses: 0 }
    };
  }

  /**
   * Determinar saída final do flow
   * @param {Object} executionResults - Resultados de todos os nodes
   * @param {Array} nodes - Nodes do flow
   * @returns {any} Saída final
   */
  determineFinalOutput(executionResults, nodes) {
    // Procurar por output nodes
    const outputNodes = nodes.filter(n => n.type === 'output');

    if (outputNodes.length > 0) {
      const outputs = outputNodes.map(node => {
        const result = executionResults[node.id];
        return result ? (result['data-out'] || result) : null;
      });

      return outputs.length === 1 ? outputs[0] : outputs;
    }

    // Fallback: último node executado
    const nodeIds = Object.keys(executionResults);
    if (nodeIds.length > 0) {
      const lastNodeId = nodeIds[nodeIds.length - 1];
      const lastResult = executionResults[lastNodeId];
      return lastResult['data-out'] || lastResult;
    }

    return null;
  }

  /**
   * Validar estrutura do flow
   * @param {Array} nodes - Lista de nodes
   * @param {Array} edges - Lista de edges
   */
  validateFlowStructure(nodes, edges) {
    if (!nodes || nodes.length === 0) {
      throw new Error('Flow must have at least one node');
    }

    // Verificar duplicatas de IDs
    const uniqueIds = new Set();
    nodes.forEach(node => {
      if (uniqueIds.has(node.id)) {
        throw new Error(`Duplicate node ID: ${node.id}`);
      }
      uniqueIds.add(node.id);
    });

    // Verificar edges válidas
    edges.forEach(edge => {
      if (!uniqueIds.has(edge.source)) {
        throw new Error(`Source node not found: ${edge.source}`);
      }
      if (!uniqueIds.has(edge.target)) {
        throw new Error(`Target node not found: ${edge.target}`);
      }
    });

    // Verificar se todos os node types existem no catálogo
    nodes.forEach(node => {
      if (!registry.hasNode(node.type)) {
        throw new Error(`Unsupported node type: ${node.type}`);
      }
    });
  }
}

// Criar instância singleton
const flowExecutor = new FlowExecutor();

module.exports = flowExecutor;

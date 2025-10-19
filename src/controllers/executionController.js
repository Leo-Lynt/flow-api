const FlowExecution = require('../models/FlowExecution');
const Flow = require('../models/Flow');
const User = require('../models/User');
const mongoose = require('mongoose');
const { formatError, formatSuccess } = require('../utils/helpers');
const { calculateObjectSize } = require('../utils/storageHelpers');

/**
 * Listar execuções do usuário com filtros
 * GET /api/executions
 * Query params: flowId, status, startDate, endDate, page, limit
 */
async function listExecutions(req, res) {
  try {
    const {
      flowId,           // Filtro por flow
      status,           // Filtro por status ('success', 'failed', 'running')
      startDate,        // Data início (ISO string)
      endDate,          // Data fim (ISO string)
      page = 1,
      limit = 20
    } = req.query;

    const userId = req.user.userId;

    // Construir query
    const query = { userId: new mongoose.Types.ObjectId(userId) };

    if (flowId) {
      query.flowId = new mongoose.Types.ObjectId(flowId);
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.startedAt = {};
      if (startDate) {
        query.startedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startedAt.$lte = new Date(endDate);
      }
    }

    // Buscar execuções com TUDO (incluindo logs)
    const executions = await FlowExecution.find(query)
      .sort({ startedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('-inputData -outputData') // Não retornar dados pesados
      .lean();

    const total = await FlowExecution.countDocuments(query);

    res.json({
      success: true,
      data: executions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error listing executions:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'LIST_EXECUTIONS_ERROR'
      }
    });
  }
}

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

/**
 * Gerenciar quota de storage do usuário
 * Deleta outputData de execuções antigas se necessário
 */
async function manageStorageQuota(userId, newOutputDataSize) {
  const user = await User.findById(userId);
  if (!user) return;

  const availableSpace = user.executionStorageQuota - user.executionStorageUsed;

  // Se tem espaço suficiente, não precisa fazer nada
  if (availableSpace >= newOutputDataSize) {
    return;
  }

  // Precisa liberar espaço - buscar execuções mais antigas com outputData
  const spaceNeeded = newOutputDataSize - availableSpace;
  let spaceFreed = 0;

  const executionsWithOutput = await FlowExecution.find({
    userId,
    outputData: { $ne: null }
  })
    .sort({ startedAt: 1 }) // Mais antigas primeiro
    .lean();

  for (const exec of executionsWithOutput) {
    if (spaceFreed >= spaceNeeded) break;

    const outputSize = calculateObjectSize(exec.outputData);

    // Remover outputData da execução
    await FlowExecution.findByIdAndUpdate(exec._id, {
      $set: { outputData: null }
    });

    spaceFreed += outputSize;
  }

  // Atualizar storage usado do usuário
  const newStorageUsed = Math.max(0, user.executionStorageUsed - spaceFreed);
  await User.findByIdAndUpdate(userId, {
    $set: { executionStorageUsed: newStorageUsed }
  });
}

/**
 * Salvar execução do frontend no histórico
 * POST /api/executions/save
 */
async function saveExecution(req, res) {
  try {
    const userId = req.user.userId;
    const {
      flowId,
      flowName,
      status,
      executionTime,
      nodesExecuted,
      inputData,
      outputData,
      flowSnapshot
    } = req.body;

    // Validar campos obrigatórios
    if (!flowId || !status || !executionTime) {
      return res.status(400).json(formatError(
        'Missing required fields: flowId, status, executionTime',
        'MISSING_FIELDS'
      ));
    }

    // Validar que o flow pertence ao usuário
    const flow = await Flow.findOne({ _id: flowId, userId });
    if (!flow) {
      return res.status(404).json(formatError(
        'Flow not found or access denied',
        'FLOW_NOT_FOUND'
      ));
    }

    // Gerenciar quota de storage se houver outputData
    let finalOutputData = outputData || null;
    if (outputData) {
      const outputSize = calculateObjectSize(outputData);
      await manageStorageQuota(userId, outputSize);

      // Atualizar storage usado
      await User.findByIdAndUpdate(userId, {
        $inc: { executionStorageUsed: outputSize }
      });
    }

    // Criar registro de execução
    const execution = await FlowExecution.create({
      flowId,
      flowName: flowName || flow.name,
      userId,
      status,
      startedAt: new Date(Date.now() - executionTime),
      completedAt: new Date(),
      executionTime,
      nodesExecuted: nodesExecuted || 0,
      inputData: inputData || {},
      outputData: finalOutputData,
      flowSnapshot: flowSnapshot || {
        totalNodes: flow.flowData?.nodes?.length || 0,
        nodes: (flow.flowData?.nodes || []).map(n => ({
          nodeId: n.id,
          type: n.type,
          name: n.type
        }))
      },
      triggeredBy: 'manual',
      logs: [],
      cacheStats: { hits: 0, misses: 0 }
    });

    // Atualizar estatísticas do flow
    await updateFlowStats(flowId, status === 'success', executionTime);

    return res.status(201).json(formatSuccess({
      executionId: execution._id,
      savedAt: execution.createdAt
    }, 'Execution saved to history'));

  } catch (error) {
    console.error('Error saving execution:', error);
    return res.status(500).json(formatError(
      'Failed to save execution',
      'SAVE_EXECUTION_ERROR'
    ));
  }
}

/**
 * Obter response de uma execução específica
 * GET /api/executions/:id/response
 */
async function getExecutionResponse(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const execution = await FlowExecution.findOne({
      _id: id,
      userId
    })
      .select('flowId inputData outputData flowName status completedAt startedAt executionTime')
      .lean();

    if (!execution) {
      return res.status(404).json(formatError(
        'Execution not found or access denied',
        'EXECUTION_NOT_FOUND'
      ));
    }

    return res.status(200).json(formatSuccess({
      executionId: id,
      flowId: execution.flowId,
      flowName: execution.flowName,
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      executionTime: execution.executionTime,
      inputData: execution.inputData,
      outputData: execution.outputData
    }, 'Execution response retrieved successfully'));

  } catch (error) {
    console.error('Error getting execution response:', error);
    return res.status(500).json(formatError(
      'Failed to get execution response',
      'GET_EXECUTION_RESPONSE_ERROR'
    ));
  }
}

/**
 * Re-executar um flow usando os mesmos inputs de uma execução anterior
 * POST /api/executions/:id/reexecute
 */
async function reexecuteFlow(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Buscar execução original
    const originalExecution = await FlowExecution.findOne({
      _id: id,
      userId
    })
      .select('flowId inputData')
      .lean();

    if (!originalExecution) {
      return res.status(404).json(formatError(
        'Execution not found or access denied',
        'EXECUTION_NOT_FOUND'
      ));
    }

    // Verificar se o flow ainda existe
    const flow = await Flow.findOne({
      _id: originalExecution.flowId,
      userId
    }).populate('flowDataId');

    if (!flow) {
      return res.status(404).json(formatError(
        'Original flow not found or was deleted',
        'FLOW_NOT_FOUND'
      ));
    }

    // Mapear flowDataId para flowData
    if (!flow.flowData && flow.flowDataId) {
      flow.flowData = flow.flowDataId.data || flow.flowDataId;
    }

    // Verificar se flow tem nodes
    if (!flow.flowData || !flow.flowData.nodes || flow.flowData.nodes.length === 0) {
      return res.status(400).json(formatError(
        'Flow does not contain nodes to execute',
        'EMPTY_FLOW'
      ));
    }

    // Executar flow com os mesmos inputs
    const flowExecutor = require('../services/flowExecutor');
    const startTime = Date.now();
    const result = await flowExecutor.executeFlow(
      flow,
      originalExecution.inputData || {},
      userId,
      'api'
    );
    const executionTime = Date.now() - startTime;

    return res.status(200).json(formatSuccess({
      message: 'Flow re-executed successfully',
      originalExecutionId: id,
      newExecutionId: result.executionId,
      outputData: result.outputData,
      executionTime,
      nodesExecuted: Object.keys(result.nodeResults).length,
      inputDataUsed: originalExecution.inputData
    }, 'Flow re-executed successfully'));

  } catch (error) {
    console.error('Error re-executing flow:', error);

    // Tratar erro de inputs obrigatórios faltando
    if (error.code === 'MISSING_REQUIRED_INPUTS') {
      return res.status(400).json(formatError(
        'Original execution inputs are no longer valid for current flow configuration',
        'MISSING_REQUIRED_INPUTS',
        {
          details: error.missingInputs
        }
      ));
    }

    return res.status(500).json(formatError(
      error.message || 'Failed to re-execute flow',
      'REEXECUTE_FLOW_ERROR'
    ));
  }
}

module.exports = {
  listExecutions,
  saveExecution,
  getExecutionResponse,
  reexecuteFlow
};

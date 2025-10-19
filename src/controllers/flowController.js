const Flow = require('../models/Flow');
const FlowData = require('../models/FlowData');
const FlowExecution = require('../models/FlowExecution');
const User = require('../models/User');
const { formatError, formatSuccess, validateFlowStructure, validateNodeTypes } = require('../utils/helpers');
const { getExampleForType } = require('../utils/inputExamples');
const securityScanService = require('../services/securityScanService');
const logger = require('../utils/logger');

/**
 * 🚀 Cria estrutura inicial de FlowData com Input e Output conectados
 * Todo flow deve começar com exatamente 1 Input e 1 Output
 */
function createInitialFlowData() {
  const timestamp = Date.now();
  const inputId = `input_${timestamp}`;
  const outputId = `output_${timestamp + 1}`;

  return {
    nodes: [
      {
        id: inputId,
        type: 'input',
        position: { x: 100, y: 200 },
        data: { label: 'Input' }
      },
      {
        id: outputId,
        type: 'output',
        position: { x: 500, y: 200 },
        data: { label: 'Output' }
      }
    ],
    edges: [
      {
        id: `${inputId}-${outputId}`,
        source: inputId,
        target: outputId,
        sourceHandle: 'exec-out',
        targetHandle: 'exec-in',
        edgeType: 'flow'
      }
    ],
    nodeData: {
      [inputId]: {},
      [outputId]: {}
    },
    detectedTypes: {},
    variables: {}
  };
}

class FlowController {
  // Listar fluxos do usuário
  async getFlows(req, res) {
    try {
      const {
        search = '',
        tags = '',
        isPublic,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const userId = req.user.userId;

      // Construir filtros
      const filters = { userId };

      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        filters.tags = { $in: tagArray };
      }

      if (isPublic !== undefined) {
        filters.isPublic = isPublic === 'true';
      }

      // Construir ordenação
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Buscar fluxos
      const flows = await Flow.find(filters)
        .sort(sortOptions)
        .lean();

      return res.status(200).json(formatSuccess({
        flows
      }, 'Fluxos obtidos com sucesso'));

    } catch (error) {
      console.error('Erro ao listar fluxos:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter fluxo específico
  async getFlow(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const flow = await Flow.findOne({ _id: id, userId });

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      return res.status(200).json(formatSuccess(flow, 'Fluxo obtido com sucesso'));

    } catch (error) {
      console.error('Erro ao obter fluxo:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Criar novo fluxo
  async createFlow(req, res) {
    try {
      const { name, description, category, isPublic } = req.body;
      const userId = req.user.userId;

      // Criar fluxo
      const flow = new Flow({
        name,
        description,
        category,
        userId,
        isPublic: isPublic || false
      });

      await flow.save();

      // Criar FlowData automaticamente com Input e Output conectados
      const flowData = new FlowData({
        flowId: flow._id,
        data: createInitialFlowData(),
        version: 1,
        lastModifiedBy: userId
      });

      await flowData.save();

      // Atualizar o flow com o flowDataId e totalNodes
      flow.flowDataId = flowData._id;
      flow.totalNodes = 2; // Input + Output
      await flow.save();

      return res.status(201).json(formatSuccess({
        ...flow.toObject(),
        flowDataId: flowData._id
      }, 'Fluxo criado com sucesso'));

    } catch (error) {
      console.error('Erro ao criar fluxo:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR'));
      }

      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Atualizar fluxo
  async updateFlow(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const updateData = req.body;

      // Verificar se o fluxo existe e pertence ao usuário
      const flow = await Flow.findOne({ _id: id, userId });

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Validar estrutura do fluxo se fornecida
      if (updateData.flowData) {
        const structureValidation = validateFlowStructure(updateData.flowData);
        if (!structureValidation.valid) {
          return res.status(400).json(formatError(structureValidation.error, 'INVALID_FLOW_STRUCTURE'));
        }

        const nodeTypesValidation = validateNodeTypes(updateData.flowData.nodes);
        if (!nodeTypesValidation.valid) {
          return res.status(400).json(formatError(nodeTypesValidation.error, 'INVALID_NODE_TYPE'));
        }
      }

      // 🔄 AUTO-PUBLICATION: Detectar mudança para isPublic = true
      const isBecomingPublic = updateData.isPublic === true && flow.isPublic === false;

      if (isBecomingPublic) {
        logger.info(`[Auto-Publish] Flow ${id} is being published by user ${userId}`);

        // Buscar usuário
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
        }

        // Buscar FlowData para security scan
        let flowDataForScan = null;
        if (flow.flowDataId) {
          flowDataForScan = await FlowData.findById(flow.flowDataId);
        }

        // Executar security scan
        const scanResult = await securityScanService.scanFlow({
          _id: id,
          flowDataId: flow.flowDataId,
          flowData: flowDataForScan
        });

        // Determinar status baseado no scan
        let publicationStatus = 'approved';
        if (scanResult.status === 'dangerous') {
          publicationStatus = 'quarantined';
        } else if (scanResult.status === 'suspicious' || scanResult.warnings.length > 0) {
          publicationStatus = 'pending_review';
        }

        // Preparar dados de publicação
        updateData.publicationData = {
          status: publicationStatus,
          publishedAt: new Date(),
          publishedBy: userId,
          approvedBy: publicationStatus === 'approved' ? userId : null,
          approvedAt: publicationStatus === 'approved' ? new Date() : null
        };

        // Preparar metadados públicos
        updateData.publicMetadata = {
          name: updateData.name || flow.name,
          description: updateData.description || flow.description,
          category: updateData.category || flow.category,
          tags: updateData.tags || flow.tags || [],
          author: {
            name: user.name,
            userId: user._id
          }
        };

        // Inicializar estatísticas públicas
        updateData.publicStats = {
          views: 0,
          imports: 0,
          rating: 0,
          ratingCount: 0
        };

        // Armazenar resultado do security scan
        updateData.securityScan = {
          lastScanAt: new Date(),
          status: scanResult.status,
          warnings: scanResult.warnings,
          detectedPatterns: scanResult.detectedPatterns,
          autoApproved: publicationStatus === 'approved'
        };

        // Atualizar contadores do usuário
        if (publicationStatus === 'approved') {
          await User.findByIdAndUpdate(userId, {
            $inc: { 'publicProfile.totalPublishedFlows': 1 }
          });
        }

        logger.info(`[Auto-Publish] Flow ${id} published with status: ${publicationStatus}, scan result: ${scanResult.status}`);
      }

      // Atualizar fluxo
      const updatedFlow = await Flow.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      return res.status(200).json(formatSuccess(updatedFlow, 'Fluxo atualizado com sucesso'));

    } catch (error) {
      console.error('Erro ao atualizar fluxo:', error);

      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR'));
      }

      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Deletar fluxo
  async deleteFlow(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const flow = await Flow.findOne({ _id: id, userId });

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Marcar execuções como órfãs (preservar histórico)
      await FlowExecution.updateMany(
        { flowId: id },
        {
          flowDeleted: true,
          deletedFlowName: flow.name,
          flowId: null
        }
      );

      // Deletar FlowData associado se existir
      if (flow.flowDataId) {
        await FlowData.findByIdAndDelete(flow.flowDataId);
      }

      // Deletar flow
      await Flow.findByIdAndDelete(id);

      return res.status(200).json(formatSuccess(null, 'Fluxo deletado com sucesso'));

    } catch (error) {
      console.error('Erro ao deletar fluxo:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Clonar fluxo
  async cloneFlow(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const originalFlow = await Flow.findOne({ _id: id, userId });

      if (!originalFlow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Criar clone do flow
      const clonedFlow = new Flow({
        name: `${originalFlow.name} (Cópia)`,
        description: originalFlow.description,
        category: originalFlow.category,
        userId,
        isPublic: false // Clone sempre privado
      });

      await clonedFlow.save();

      // Se existir FlowData, clonar também
      if (originalFlow.flowDataId) {
        const originalFlowData = await FlowData.findById(originalFlow.flowDataId);

        if (originalFlowData) {
          const clonedFlowData = new FlowData({
            flowId: clonedFlow._id,
            data: originalFlowData.data ? JSON.parse(JSON.stringify(originalFlowData.data)) : null,
            version: 1,
            lastModifiedBy: userId
          });

          await clonedFlowData.save();

          // Atualizar o clone com o novo flowDataId
          clonedFlow.flowDataId = clonedFlowData._id;
          await clonedFlow.save();
        }
      }

      return res.status(201).json(formatSuccess(clonedFlow, 'Fluxo clonado com sucesso'));

    } catch (error) {
      console.error('Erro ao clonar fluxo:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter estatísticas do fluxo
  async getFlowStats(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const flow = await Flow.findOne({ _id: id, userId });

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Buscar FlowData associado
      let flowData = null;
      if (flow.flowDataId) {
        flowData = await FlowData.findById(flow.flowDataId);
      }

      // Calcular estatísticas básicas
      const stats = {
        hasData: flowData && flowData.data !== null,
        dataSize: flowData && flowData.data ? JSON.stringify(flowData.data).length : 0,
        executionCount: flow.executionCount || 0,
        lastExecutedAt: flow.lastExecutedAt,
        version: flowData ? flowData.version : 0,
        lastModifiedBy: flowData ? flowData.lastModifiedBy : null,
        lastModifiedAt: flowData ? flowData.updatedAt : null
      };

      return res.status(200).json(formatSuccess(stats, 'Estatísticas obtidas com sucesso'));

    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Listar fluxos públicos
  async getPublicFlows(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        tags = '',
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;

      // Construir filtros (apenas fluxos públicos)
      const filters = { isPublic: true };

      if (search) {
        filters.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        filters.tags = { $in: tagArray };
      }

      // Construir ordenação
      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Buscar fluxos públicos
      const [flows, total] = await Promise.all([
        Flow.find(filters)
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit))
          .populate('userId', 'name')
          .lean(),
        Flow.countDocuments(filters)
      ]);

      const pagination = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      };

      return res.status(200).json(formatSuccess({
        flows,
        pagination
      }, 'Fluxos públicos obtidos com sucesso'));

    } catch (error) {
      console.error('Erro ao listar fluxos públicos:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Executar fluxo completo
  async executeFlow(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const { inputData = {}, options = {} } = req.body;

      // Buscar flow e popular flowData
      const flow = await Flow.findOne({ _id: id, userId }).populate('flowDataId');

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Mapear flowDataId para flowData para compatibilidade
      if (!flow.flowData && flow.flowDataId) {
        flow.flowData = flow.flowDataId.data || flow.flowDataId;
      }

      // Verificar se flow tem nodes
      if (!flow.flowData || !flow.flowData.nodes || flow.flowData.nodes.length === 0) {
        return res.status(400).json(formatError('Flow não contém nodes para executar', 'EMPTY_FLOW'));
      }

      // Executar flow usando o flowExecutor
      const flowExecutor = require('../services/flowExecutor');

      // Log início da execução
      logger.info('Flow execution started', {
        type: 'flow_execution_start',
        flowId: id,
        userId,
        correlationId: req.correlationId,
        nodeCount: flow.flowData.nodes.length
      });

      const startTime = Date.now();
      const result = await flowExecutor.executeFlow(flow, inputData, userId, 'api');
      const executionTime = Date.now() - startTime;

      // Log sucesso
      logger.logFlowExecution(id, userId, 'success', executionTime, {
        correlationId: req.correlationId,
        nodesExecuted: Object.keys(result.nodeResults).length
      });

      return res.status(200).json(formatSuccess({
        outputData: result.outputData,
        executionTime,
        nodesExecuted: Object.keys(result.nodeResults).length,
        ...(options.includeNodeResults && { nodeResults: result.nodeResults })
      }, 'Flow executado com sucesso'));

    } catch (error) {
      // Log erro
      logger.error('Flow execution failed', {
        type: 'flow_execution_error',
        flowId: req.params.id,
        userId: req.user.userId,
        correlationId: req.correlationId,
        error: error.message,
        stack: error.stack
      });

      // Tratar erro de inputs obrigatórios faltando
      if (error.code === 'MISSING_REQUIRED_INPUTS') {
        // Construir exemplo completo com valores default ou exemplos
        const exampleInputData = {};
        const missingDetails = [];

        error.missingInputs.forEach(mi => {
          const exampleValue = getExampleForType(mi.parameterType, mi.defaultValue);
          exampleInputData[mi.parameterName] = exampleValue;

          missingDetails.push({
            name: mi.parameterName,
            type: mi.parameterType,
            description: mi.description || null,
            suggestedValue: exampleValue
          });
        });

        return res.status(400).json(formatError(
          `Missing ${error.missingInputs.length} required input${error.missingInputs.length > 1 ? 's' : ''}: ${error.missingInputs.map(m => m.parameterName).join(', ')}`,
          'MISSING_REQUIRED_INPUTS',
          {
            missing: missingDetails,
            howToFix: {
              description: 'Send the missing inputs in your request body using the example below',
              method: 'POST',
              endpoint: `/api/flows/${req.params.id}/execute`,
              exampleRequest: {
                inputData: exampleInputData
              }
            }
          }
        ));
      }

      // Identificar tipo de erro
      if (error.message.includes('não encontrado')) {
        return res.status(404).json(formatError(error.message, 'NODE_NOT_FOUND'));
      }

      if (error.message.includes('circular')) {
        return res.status(400).json(formatError(error.message, 'CIRCULAR_DEPENDENCY'));
      }

      if (error.message.includes('Timeout')) {
        return res.status(408).json(formatError('Execução excedeu tempo limite', 'TIMEOUT'));
      }

      return res.status(500).json(formatError(
        error.message || 'Erro ao executar flow',
        'EXECUTION_ERROR'
      ));
    }
  }

  // Obter inputs de um flow específico
  async getFlowInputs(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Buscar flow e validar ownership
      const flow = await Flow.findOne({ _id: id, userId }).populate('flowDataId');

      if (!flow) {
        return res.status(404).json(formatError('Fluxo não encontrado', 'FLOW_NOT_FOUND'));
      }

      // Mapear flowDataId para flowData
      if (!flow.flowData && flow.flowDataId) {
        flow.flowData = flow.flowDataId.data || flow.flowDataId;
      }

      if (!flow.flowData) {
        return res.status(200).json(formatSuccess({
          flowId: flow._id,
          flowName: flow.name,
          totalInputs: 0,
          inputs: [],
          example: null
        }, 'Flow não possui dados'));
      }

      const { nodes, nodeData = {} } = flow.flowData;

      // Encontrar todos os input nodes
      const inputNodes = nodes.filter(n => n.type === 'input');

      const inputs = [];

      inputNodes.forEach(node => {
        const data = nodeData[node.id] || {};
        const parameters = data.parameters || [];

        parameters.forEach(param => {
          inputs.push({
            name: param.name,
            type: param.type,
            required: param.required || false,
            defaultValue: param.defaultValue,
            description: param.description || null,
            nodeId: node.id,
            nodeName: data.label || 'Input'
          });
        });
      });

      return res.status(200).json(formatSuccess({
        flowId: flow._id,
        flowName: flow.name,
        totalInputs: inputs.length,
        inputs,
        example: inputs.length > 0 ? {
          endpoint: `POST /api/flows/${id}/execute`,
          body: {
            inputData: inputs.reduce((acc, input) => {
              acc[input.name] = getExampleForType(input.type);
              return acc;
            }, {})
          }
        } : null
      }, 'Flow inputs obtidos com sucesso'));

    } catch (error) {
      console.error('Error getting flow inputs:', error);
      return res.status(500).json(formatError('Erro ao obter inputs do flow', 'GET_FLOW_INPUTS_ERROR'));
    }
  }
}


module.exports = new FlowController();
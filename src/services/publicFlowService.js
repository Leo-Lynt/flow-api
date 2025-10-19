const Flow = require('../models/Flow');
const FlowReview = require('../models/FlowReview');
const FlowReport = require('../models/FlowReport');
const User = require('../models/User');
const FlowData = require('../models/FlowData');
const securityScanService = require('./securityScanService');
const logger = require('../utils/logger');
const { formatSuccess, formatError } = require('../utils/helpers');

class PublicFlowService {
  /**
   * Publica um flow
   */
  async publishFlow(flowId, userId, publicationData) {
    try {
      const flow = await Flow.findOne({ _id: flowId, userId });

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      // Verificar limites do usuário
      const user = await User.findById(userId);
      const limitsCheck = await this.checkPublicationLimits(user);
      if (!limitsCheck.allowed) {
        return formatError(limitsCheck.message, 'PUBLICATION_LIMIT_EXCEEDED');
      }

      // Validar dados de publicação
      const validation = await securityScanService.validateForPublication({
        ...flow.toObject(),
        publicMetadata: publicationData
      });

      if (!validation.isValid) {
        return formatError(validation.errors.join(', '), 'VALIDATION_ERROR', { errors: validation.errors });
      }

      // Executar security scan
      const scanResult = await securityScanService.scanFlow(flow);

      // Determinar status baseado no scan
      let status = 'approved'; // Auto-aprovar por padrão
      if (scanResult.status === 'dangerous') {
        status = 'quarantined'; // Quarentena se perigoso
      } else if (scanResult.status === 'suspicious' && scanResult.warnings.length > 3) {
        status = 'pending_review'; // Revisão manual se muito suspeito
      }

      // Atualizar flow
      flow.isPublic = true;
      flow.publicationData = {
        status: status,
        publishedAt: new Date(),
        lastUpdatedAt: new Date(),
        moderationNotes: status === 'approved' ? 'Auto-aprovado após scan de segurança' : null
      };

      flow.publicMetadata = {
        ...publicationData,
        author: {
          name: user.publicProfile?.displayName || user.name,
          userId: user._id
        }
      };

      flow.securityScan = {
        lastScannedAt: new Date(),
        status: scanResult.status,
        warnings: scanResult.warnings,
        detectedPatterns: scanResult.detectedPatterns
      };

      // Inicializar stats públicas
      if (!flow.publicStats) {
        flow.publicStats = {
          views: 0,
          imports: 0,
          forks: 0,
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          totalReviews: 0,
          totalReports: 0,
          reportCategories: { spam: 0, malicious: 0, broken: 0, duplicate: 0, inappropriate: 0 }
        };
      }

      await flow.save();

      // Atualizar stats do usuário
      user.publicProfile.publicStats.totalPublicFlows += 1;
      user.publicProfile.publicationLimits.lastPublishedAt = new Date();
      await user.save();

      logger.info(`Flow ${flowId} published by user ${userId}`);

      return formatSuccess({
        flow,
        scanResult,
        validationWarnings: validation.warnings
      }, 'Flow enviado para revisão');
    } catch (error) {
      logger.error('Error publishing flow:', error);
      throw error;
    }
  }

  /**
   * Despublica um flow
   */
  async unpublishFlow(flowId, userId) {
    try {
      const flow = await Flow.findOne({ _id: flowId, userId });

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      if (!flow.isPublic) {
        return formatError('Flow já está privado', 'FLOW_NOT_PUBLIC');
      }

      flow.isPublic = false;
      flow.publicationData.status = 'draft';
      await flow.save();

      // Atualizar stats do usuário
      const user = await User.findById(userId);
      user.publicProfile.publicStats.totalPublicFlows -= 1;
      await user.save();

      logger.info(`Flow ${flowId} unpublished by user ${userId}`);

      return formatSuccess(flow, 'Flow despublicado com sucesso');
    } catch (error) {
      logger.error('Error unpublishing flow:', error);
      throw error;
    }
  }

  /**
   * Lista flows públicos com filtros e paginação
   */
  async listPublicFlows(filters = {}, pagination = {}) {
    try {
      const {
        search,
        category,
        difficulty,
        tags,
        verifiedOnly,
        sortBy = 'popular',
        page = 1,
        limit = 20
      } = { ...filters, ...pagination };

      // Build query
      const query = {
        isPublic: true,
        'publicationData.status': 'approved'
      };

      if (category) {
        query.category = category;
      }

      if (difficulty) {
        query['publicMetadata.difficulty'] = difficulty;
      }

      if (tags && tags.length > 0) {
        query['publicMetadata.tags'] = { $in: tags };
      }

      if (verifiedOnly) {
        query['publicationData.isVerified'] = true;
      }

      if (search) {
        query.$text = { $search: search };
      }

      // Build sort
      let sort = {};
      switch (sortBy) {
        case 'popular':
          sort = { 'publicStats.imports': -1, 'publicStats.views': -1 };
          break;
        case 'rating':
          sort = { 'publicStats.averageRating': -1, 'publicStats.totalRatings': -1 };
          break;
        case 'recent':
          sort = { 'publicationData.publishedAt': -1 };
          break;
        case 'name':
          sort = { name: 1 };
          break;
        default:
          sort = { 'publicStats.imports': -1 };
      }

      const skip = (page - 1) * limit;

      const [flows, total] = await Promise.all([
        Flow.find(query)
          .select('-flowDataId -executionStats')
          .populate('publicMetadata.author.userId', 'name publicProfile.displayName publicProfile.avatar publicProfile.isVerifiedCreator')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Flow.countDocuments(query)
      ]);

      return formatSuccess({
        flows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing public flows:', error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um flow público
   */
  async getPublicFlowDetails(flowId, userId = null) {
    try {
      const flow = await Flow.findOne({
        _id: flowId,
        isPublic: true,
        'publicationData.status': 'approved'
      })
        .populate('publicMetadata.author.userId', 'name publicProfile')
        .lean();

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      // Incrementar views
      await Flow.updateOne({ _id: flowId }, { $inc: { 'publicStats.views': 1 } });

      // Buscar reviews recentes
      const reviews = await FlowReview.find({ flowId, moderationStatus: 'active' })
        .populate('userId', 'name publicProfile.displayName publicProfile.avatar')
        .sort({ helpful: -1, createdAt: -1 })
        .limit(10)
        .lean();

      // Buscar flows relacionados (mesma categoria)
      const relatedFlows = await Flow.find({
        _id: { $ne: flowId },
        category: flow.category,
        isPublic: true,
        'publicationData.status': 'approved'
      })
        .select('name description category publicStats publicMetadata.author publicMetadata.difficulty publicMetadata.tags')
        .sort({ 'publicStats.averageRating': -1 })
        .limit(5)
        .lean();

      // Verificar se usuário já fez review
      let userReview = null;
      if (userId) {
        userReview = await FlowReview.findOne({ flowId, userId }).lean();
      }

      return formatSuccess({
        flow,
        reviews,
        relatedFlows,
        userReview
      });
    } catch (error) {
      logger.error('Error getting public flow details:', error);
      throw error;
    }
  }

  /**
   * Importa um flow público para a biblioteca privada do usuário
   */
  async importFlow(flowId, userId) {
    try {
      const originalFlow = await Flow.findOne({
        _id: flowId,
        isPublic: true,
        'publicationData.status': 'approved'
      }).populate('flowDataId');

      if (!originalFlow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      // Criar cópia do flow
      const importedFlow = new Flow({
        name: `${originalFlow.name} (Imported)`,
        description: originalFlow.description,
        category: originalFlow.category,
        userId: userId,
        isPublic: false,
        totalNodes: originalFlow.totalNodes,
        publicMetadata: {
          originalFlowId: originalFlow._id,
          author: originalFlow.publicMetadata.author,
          license: originalFlow.publicMetadata.license,
          requireAttribution: originalFlow.publicMetadata.requireAttribution
        }
      });

      // Copiar flow data
      if (originalFlow.flowDataId) {
        const originalFlowData = await FlowData.findById(originalFlow.flowDataId);
        if (originalFlowData) {
          const sanitizedData = await securityScanService.sanitizeFlowForPublication(originalFlowData.toObject());

          const newFlowData = new FlowData({
            ...sanitizedData,
            _id: undefined,
            flowId: importedFlow._id
          });
          await newFlowData.save();
          importedFlow.flowDataId = newFlowData._id;
        }
      }

      await importedFlow.save();

      // Incrementar contador de imports no flow original
      await Flow.updateOne({ _id: flowId }, { $inc: { 'publicStats.imports': 1 } });

      // Atualizar stats do autor original
      if (originalFlow.publicMetadata.author.userId) {
        await User.updateOne(
          { _id: originalFlow.publicMetadata.author.userId },
          { $inc: { 'publicProfile.publicStats.totalDownloads': 1 } }
        );
      }

      logger.info(`Flow ${flowId} imported by user ${userId}`);

      return formatSuccess(importedFlow, 'Flow importado com sucesso');
    } catch (error) {
      logger.error('Error importing flow:', error);
      throw error;
    }
  }

  /**
   * Cria um fork de um flow público
   */
  async forkFlow(flowId, userId) {
    try {
      const originalFlow = await Flow.findOne({
        _id: flowId,
        isPublic: true,
        'publicationData.status': 'approved'
      }).populate('flowDataId');

      if (!originalFlow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      if (!originalFlow.publicMetadata.allowForking) {
        return formatError('Este flow não permite forks', 'FORKING_NOT_ALLOWED');
      }

      // Criar fork do flow
      const forkedFlow = new Flow({
        name: `${originalFlow.name} (Fork)`,
        description: originalFlow.description,
        category: originalFlow.category,
        userId: userId,
        isPublic: false,
        totalNodes: originalFlow.totalNodes,
        publicMetadata: {
          forkedFrom: originalFlow._id,
          originalFlowId: originalFlow.publicMetadata.originalFlowId || originalFlow._id,
          forkChain: [...(originalFlow.publicMetadata.forkChain || []), originalFlow._id],
          author: originalFlow.publicMetadata.author,
          license: originalFlow.publicMetadata.license,
          requireAttribution: originalFlow.publicMetadata.requireAttribution
        }
      });

      // Copiar flow data
      if (originalFlow.flowDataId) {
        const originalFlowData = await FlowData.findById(originalFlow.flowDataId);
        if (originalFlowData) {
          const sanitizedData = await securityScanService.sanitizeFlowForPublication(originalFlowData.toObject());

          const newFlowData = new FlowData({
            ...sanitizedData,
            _id: undefined,
            flowId: forkedFlow._id
          });
          await newFlowData.save();
          forkedFlow.flowDataId = newFlowData._id;
        }
      }

      await forkedFlow.save();

      // Incrementar contador de forks no flow original
      await Flow.updateOne({ _id: flowId }, { $inc: { 'publicStats.forks': 1 } });

      logger.info(`Flow ${flowId} forked by user ${userId}`);

      return formatSuccess(forkedFlow, 'Fork criado com sucesso');
    } catch (error) {
      logger.error('Error forking flow:', error);
      throw error;
    }
  }

  /**
   * Verifica limites de publicação do usuário
   */
  async checkPublicationLimits(user) {
    const limits = user.publicProfile?.publicationLimits || {
      maxPublicFlows: 10,
      cooldownHours: 24,
      lastPublishedAt: null
    };

    // Verificar limite de flows públicos
    const publicFlowsCount = await Flow.countDocuments({
      userId: user._id,
      isPublic: true,
      'publicationData.status': { $in: ['pending_review', 'approved'] }
    });

    if (publicFlowsCount >= limits.maxPublicFlows) {
      return {
        allowed: false,
        message: `Você atingiu o limite de ${limits.maxPublicFlows} flows públicos`
      };
    }

    // Verificar cooldown
    if (limits.lastPublishedAt) {
      const hoursSinceLastPublish = (Date.now() - new Date(limits.lastPublishedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastPublish < limits.cooldownHours) {
        const hoursRemaining = Math.ceil(limits.cooldownHours - hoursSinceLastPublish);
        return {
          allowed: false,
          message: `Aguarde ${hoursRemaining}h antes de publicar outro flow`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Calcula estatísticas da biblioteca pública
   */
  async getPublicLibraryStats() {
    try {
      const [totalFlows, totalDownloads, verifiedFlows] = await Promise.all([
        Flow.countDocuments({ isPublic: true, 'publicationData.status': 'approved' }),
        Flow.aggregate([
          { $match: { isPublic: true, 'publicationData.status': 'approved' } },
          { $group: { _id: null, total: { $sum: '$publicStats.imports' } } }
        ]),
        Flow.countDocuments({ isPublic: true, 'publicationData.status': 'approved', 'publicationData.isVerified': true })
      ]);

      return formatSuccess({
        totalFlows,
        totalDownloads: totalDownloads[0]?.total || 0,
        verifiedFlows
      });
    } catch (error) {
      logger.error('Error getting library stats:', error);
      throw error;
    }
  }
}

module.exports = new PublicFlowService();

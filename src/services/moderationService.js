const FlowReport = require('../models/FlowReport');
const Flow = require('../models/Flow');
const User = require('../models/User');
const logger = require('../utils/logger');
const { formatSuccess, formatError } = require('../utils/helpers');

class ModerationService {
  /**
   * Cria um report para um flow
   */
  async createReport(flowId, userId, reportData, requestInfo = {}) {
    try {
      const { category, reason } = reportData;

      // Verificar se flow existe e é público
      const flow = await Flow.findOne({
        _id: flowId,
        isPublic: true
      });

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      // Verificar se usuário já reportou este flow
      const existingReport = await FlowReport.findOne({ flowId, reportedBy: userId });
      if (existingReport) {
        return formatError('Você já reportou este flow', 'REPORT_ALREADY_EXISTS');
      }

      // Criar report
      const report = new FlowReport({
        flowId,
        reportedBy: userId,
        category,
        reason,
        ipAddress: requestInfo.ip,
        userAgent: requestInfo.userAgent
      });

      await report.save();

      // Incrementar contador de reports no flow
      await Flow.updateOne(
        { _id: flowId },
        {
          $inc: {
            'publicStats.totalReports': 1,
            [`publicStats.reportCategories.${category}`]: 1
          }
        }
      );

      // Verificar threshold de auto-quarentena (5 reports)
      const totalReports = await FlowReport.countDocuments({
        flowId,
        status: 'pending'
      });

      if (totalReports >= 5 && flow.publicationData.status === 'approved') {
        await Flow.updateOne(
          { _id: flowId },
          {
            $set: {
              'publicationData.status': 'quarantined',
              'publicationData.quarantineReason': 'Múltiplos reports recebidos (auto-quarentena)'
            }
          }
        );

        logger.warn(`Flow ${flowId} auto-quarantined due to ${totalReports} reports`);
      }

      logger.info(`Report created for flow ${flowId} by user ${userId}: ${category}`);

      return formatSuccess(report, 'Report enviado com sucesso');
    } catch (error) {
      logger.error('Error creating report:', error);
      throw error;
    }
  }

  /**
   * Lista reports pendentes (moderadores)
   */
  async listReports(filters = {}, pagination = {}) {
    try {
      const {
        status = 'pending',
        category,
        flowId,
        page = 1,
        limit = 20
      } = { ...filters, ...pagination };

      const query = {};

      if (status) query.status = status;
      if (category) query.category = category;
      if (flowId) query.flowId = flowId;

      const skip = (page - 1) * limit;

      const [reports, total] = await Promise.all([
        FlowReport.find(query)
          .populate('flowId', 'name description publicMetadata.author')
          .populate('reportedBy', 'name email')
          .populate('reviewedBy', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        FlowReport.countDocuments(query)
      ]);

      return formatSuccess({
        reports,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing reports:', error);
      throw error;
    }
  }

  /**
   * Resolve um report (moderadores)
   */
  async resolveReport(reportId, moderatorId, resolution) {
    try {
      const { action, reviewNotes } = resolution;

      const report = await FlowReport.findById(reportId);
      if (!report) {
        return formatError('Report não encontrado', 'REPORT_NOT_FOUND');
      }

      // Atualizar report
      report.status = 'resolved';
      report.reviewedBy = moderatorId;
      report.reviewedAt = new Date();
      report.reviewNotes = reviewNotes;
      report.action = action;
      await report.save();

      // Executar ação se necessário
      if (action && action !== 'no_action') {
        await this.executeModerationAction(report.flowId, action, moderatorId, reviewNotes);
      }

      logger.info(`Report ${reportId} resolved by moderator ${moderatorId}: ${action}`);

      return formatSuccess(report, 'Report resolvido com sucesso');
    } catch (error) {
      logger.error('Error resolving report:', error);
      throw error;
    }
  }

  /**
   * Executa uma ação de moderação em um flow
   */
  async executeModerationAction(flowId, action, moderatorId, notes) {
    try {
      const flow = await Flow.findById(flowId);
      if (!flow) return;

      switch (action) {
        case 'quarantine':
          flow.publicationData.status = 'quarantined';
          flow.publicationData.quarantineReason = notes || 'Flow em análise de moderação';
          flow.publicationData.moderatedBy = moderatorId;
          flow.publicationData.moderatedAt = new Date();
          await flow.save();
          logger.info(`Flow ${flowId} quarantined by moderator ${moderatorId}`);
          break;

        case 'delete':
          flow.isPublic = false;
          flow.publicationData.status = 'rejected';
          flow.publicationData.rejectionReason = notes || 'Flow removido por violar políticas';
          flow.publicationData.moderatedBy = moderatorId;
          flow.publicationData.moderatedAt = new Date();
          await flow.save();
          logger.info(`Flow ${flowId} deleted by moderator ${moderatorId}`);
          break;

        case 'warn_author':
          // TODO: Enviar email/notificação para o autor
          logger.info(`Warning sent to author of flow ${flowId}`);
          break;

        case 'ban_author':
          if (flow.userId) {
            await User.updateOne(
              { _id: flow.userId },
              {
                $set: {
                  'publicProfile.publicationLimits.maxPublicFlows': 0,
                  isActive: false
                }
              }
            );
            logger.warn(`Author ${flow.userId} banned by moderator ${moderatorId}`);
          }
          break;

        case 'no_action':
          // Apenas marcar todos reports como dismissed
          await FlowReport.updateMany(
            { flowId, status: 'pending' },
            { $set: { status: 'dismissed', reviewedBy: moderatorId, reviewedAt: new Date() } }
          );
          break;
      }
    } catch (error) {
      logger.error('Error executing moderation action:', error);
      throw error;
    }
  }

  /**
   * Lista flows pendentes de aprovação (moderadores)
   */
  async listPendingFlows(options = {}) {
    try {
      const { page = 1, limit = 20 } = options;

      const query = {
        isPublic: true,
        'publicationData.status': 'pending_review'
      };

      const skip = (page - 1) * limit;

      const [flows, total] = await Promise.all([
        Flow.find(query)
          .populate('userId', 'name email publicProfile')
          .populate('publicMetadata.author.userId', 'name publicProfile.displayName')
          .select('-flowDataId')
          .sort({ 'publicationData.publishedAt': 1 })
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
      logger.error('Error listing pending flows:', error);
      throw error;
    }
  }

  /**
   * Lista TODOS os flows públicos aprovados (moderadores)
   */
  async listAllPublicFlows(filters = {}, pagination = {}) {
    try {
      const {
        search,
        category,
        verified, // true, false, ou undefined (todos)
        sortBy = 'recent',
        page = 1,
        limit = 20
      } = { ...filters, ...pagination };

      const query = {
        isPublic: true,
        'publicationData.status': 'approved'
      };

      // Filtro de busca
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { 'publicMetadata.author.name': { $regex: search, $options: 'i' } }
        ];
      }

      // Filtro de categoria
      if (category) {
        query.category = category;
      }

      // Filtro de verificado
      if (verified === 'true') {
        query['publicationData.isVerified'] = true;
      } else if (verified === 'false') {
        query['publicationData.isVerified'] = { $ne: true };
      }

      // Ordenação
      let sort = {};
      switch (sortBy) {
        case 'recent':
          sort = { 'publicationData.publishedAt': -1 };
          break;
        case 'popular':
          sort = { 'publicStats.imports': -1 };
          break;
        case 'rating':
          sort = { 'publicStats.averageRating': -1 };
          break;
        case 'verified':
          sort = { 'publicationData.isVerified': -1, 'publicationData.verifiedAt': -1 };
          break;
        default:
          sort = { 'publicationData.publishedAt': -1 };
      }

      const skip = (page - 1) * limit;

      const [flows, total] = await Promise.all([
        Flow.find(query)
          .populate('userId', 'name email publicProfile')
          .populate('publicMetadata.author.userId', 'name publicProfile.displayName')
          .select('-flowDataId')
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
      logger.error('Error listing all public flows:', error);
      throw error;
    }
  }

  /**
   * Aprova um flow (moderadores)
   */
  async approveFlow(flowId, moderatorId, notes = '') {
    try {
      const flow = await Flow.findById(flowId);

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      if (flow.publicationData.status !== 'pending_review' && flow.publicationData.status !== 'quarantined') {
        return formatError('Flow não está pendente de aprovação', 'INVALID_STATUS');
      }

      flow.publicationData.status = 'approved';
      flow.publicationData.moderatedBy = moderatorId;
      flow.publicationData.moderatedAt = new Date();
      flow.publicationData.moderationNotes = notes;

      await flow.save();

      logger.info(`Flow ${flowId} approved by moderator ${moderatorId}`);

      return formatSuccess(flow, 'Flow aprovado com sucesso');
    } catch (error) {
      logger.error('Error approving flow:', error);
      throw error;
    }
  }

  /**
   * Rejeita um flow (moderadores)
   */
  async rejectFlow(flowId, moderatorId, reason) {
    try {
      const flow = await Flow.findById(flowId);

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      flow.publicationData.status = 'rejected';
      flow.publicationData.rejectionReason = reason;
      flow.publicationData.moderatedBy = moderatorId;
      flow.publicationData.moderatedAt = new Date();
      flow.isPublic = false;

      await flow.save();

      // TODO: Notificar autor

      logger.info(`Flow ${flowId} rejected by moderator ${moderatorId}`);

      return formatSuccess(flow, 'Flow rejeitado');
    } catch (error) {
      logger.error('Error rejecting flow:', error);
      throw error;
    }
  }

  /**
   * Adiciona badge de verificado a um flow (moderadores)
   */
  async verifyFlow(flowId, moderatorId) {
    try {
      const flow = await Flow.findById(flowId);

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      // Permitir verificar flows aprovados ou pendentes de revisão
      if (!['approved', 'pending_review'].includes(flow.publicationData.status)) {
        return formatError('Flow precisa estar aprovado ou pendente de revisão', 'INVALID_STATUS');
      }

      flow.publicationData.isVerified = true;
      flow.publicationData.verifiedBy = moderatorId;
      flow.publicationData.verifiedAt = new Date();

      await flow.save();

      logger.info(`Flow ${flowId} verified by moderator ${moderatorId}`);

      return formatSuccess(flow, 'Flow verificado com sucesso');
    } catch (error) {
      logger.error('Error verifying flow:', error);
      throw error;
    }
  }

  /**
   * Remove badge de verificado (moderadores)
   */
  async unverifyFlow(flowId, moderatorId) {
    try {
      const flow = await Flow.findById(flowId);

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      flow.publicationData.isVerified = false;
      flow.publicationData.verifiedBy = null;
      flow.publicationData.verifiedAt = null;

      await flow.save();

      logger.info(`Flow ${flowId} unverified by moderator ${moderatorId}`);

      return formatSuccess(flow, 'Verificação removida');
    } catch (error) {
      logger.error('Error unverifying flow:', error);
      throw error;
    }
  }

  /**
   * Move flow para quarentena (moderadores)
   */
  async quarantineFlow(flowId, moderatorId, reason = '') {
    try {
      const flow = await Flow.findById(flowId);

      if (!flow) {
        return formatError('Flow não encontrado', 'FLOW_NOT_FOUND');
      }

      if (flow.publicationData.status === 'quarantined') {
        return formatError('Flow já está em quarentena', 'ALREADY_QUARANTINED');
      }

      flow.publicationData.status = 'quarantined';
      flow.publicationData.quarantineReason = reason || 'Movido para quarentena por moderador';
      flow.publicationData.moderatedBy = moderatorId;
      flow.publicationData.moderatedAt = new Date();

      await flow.save();

      logger.warn(`Flow ${flowId} quarantined by moderator ${moderatorId}. Reason: ${reason}`);

      return formatSuccess(flow, 'Flow movido para quarentena');
    } catch (error) {
      logger.error('Error quarantining flow:', error);
      throw error;
    }
  }

  /**
   * Estatísticas de moderação
   */
  async getModerationStats() {
    try {
      const [
        pendingFlows,
        pendingReports,
        quarantinedFlows,
        rejectedFlows,
        totalReportsToday
      ] = await Promise.all([
        Flow.countDocuments({ 'publicationData.status': 'pending_review' }),
        FlowReport.countDocuments({ status: 'pending' }),
        Flow.countDocuments({ 'publicationData.status': 'quarantined' }),
        Flow.countDocuments({ 'publicationData.status': 'rejected' }),
        FlowReport.countDocuments({
          status: 'pending',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);

      return formatSuccess({
        pendingFlows,
        pendingReports,
        quarantinedFlows,
        rejectedFlows,
        totalReportsToday
      });
    } catch (error) {
      logger.error('Error getting moderation stats:', error);
      throw error;
    }
  }
}

module.exports = new ModerationService();

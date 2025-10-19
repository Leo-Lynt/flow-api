const publicFlowService = require('../services/publicFlowService');
const reviewService = require('../services/reviewService');
const moderationService = require('../services/moderationService');
const { formatError } = require('../utils/helpers');

class PublicFlowController {
  // ==================== PUBLIC FLOWS ====================

  /**
   * Lista flows públicos
   */
  async listPublicFlows(req, res) {
    try {
      const filters = {
        search: req.query.search,
        category: req.query.category,
        difficulty: req.query.difficulty,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        verifiedOnly: req.query.verifiedOnly === 'true',
        sortBy: req.query.sortBy || 'popular'
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await publicFlowService.listPublicFlows(filters, pagination);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error listing public flows:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém detalhes de um flow público
   */
  async getPublicFlowDetails(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user?.userId || null;

      const result = await publicFlowService.getPublicFlowDetails(flowId, userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting flow details:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Publica um flow
   */
  async publishFlow(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;
      const publicationData = req.body;

      const result = await publicFlowService.publishFlow(flowId, userId, publicationData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error publishing flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Despublica um flow
   */
  async unpublishFlow(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;

      const result = await publicFlowService.unpublishFlow(flowId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error unpublishing flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Importa um flow público
   */
  async importFlow(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;

      const result = await publicFlowService.importFlow(flowId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error importing flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Cria um fork de um flow
   */
  async forkFlow(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;

      const result = await publicFlowService.forkFlow(flowId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error forking flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém estatísticas da biblioteca pública
   */
  async getLibraryStats(req, res) {
    try {
      const result = await publicFlowService.getPublicLibraryStats();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting library stats:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // ==================== REVIEWS ====================

  /**
   * Cria uma review
   */
  async createReview(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;
      const reviewData = req.body;

      const result = await reviewService.createReview(flowId, userId, reviewData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error('Error creating review:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Atualiza uma review
   */
  async updateReview(req, res) {
    try {
      const { reviewId } = req.params;
      const userId = req.user.userId;
      const updateData = req.body;

      const result = await reviewService.updateReview(reviewId, userId, updateData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error updating review:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Deleta uma review
   */
  async deleteReview(req, res) {
    try {
      const { reviewId } = req.params;
      const userId = req.user.userId;

      const result = await reviewService.deleteReview(reviewId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting review:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Lista reviews de um flow
   */
  async listReviews(req, res) {
    try {
      const { flowId } = req.params;
      const options = {
        sortBy: req.query.sortBy,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        minRating: req.query.minRating ? parseInt(req.query.minRating) : null
      };

      const result = await reviewService.listFlowReviews(flowId, options);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error listing reviews:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Marca review como útil
   */
  async markReviewHelpful(req, res) {
    try {
      const { reviewId } = req.params;
      const userId = req.user.userId;

      const result = await reviewService.markReviewAsHelpful(reviewId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém review do usuário para um flow
   */
  async getUserReview(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;

      const result = await reviewService.getUserReview(flowId, userId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting user review:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // ==================== REPORTS ====================

  /**
   * Cria um report
   */
  async createReport(req, res) {
    try {
      const { flowId } = req.params;
      const userId = req.user.userId;
      const reportData = req.body;
      const requestInfo = {
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      const result = await moderationService.createReport(flowId, userId, reportData, requestInfo);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error('Error creating report:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // ==================== MODERATION ====================

  /**
   * Lista flows pendentes de aprovação
   */
  async listPendingFlows(req, res) {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await moderationService.listPendingFlows(options);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error listing pending flows:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Lista reports
   */
  async listReports(req, res) {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        flowId: req.query.flowId
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await moderationService.listReports(filters, pagination);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error listing reports:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Resolve um report
   */
  async resolveReport(req, res) {
    try {
      const { reportId } = req.params;
      const moderatorId = req.user.userId;
      const resolution = req.body;

      const result = await moderationService.resolveReport(reportId, moderatorId, resolution);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error resolving report:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Aprova um flow
   */
  async approveFlow(req, res) {
    try {
      const { flowId } = req.params;
      const moderatorId = req.user.userId;
      const { notes } = req.body;

      const result = await moderationService.approveFlow(flowId, moderatorId, notes);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error approving flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Rejeita um flow
   */
  async rejectFlow(req, res) {
    try {
      const { flowId } = req.params;
      const moderatorId = req.user.userId;
      const { reason } = req.body;

      const result = await moderationService.rejectFlow(flowId, moderatorId, reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error rejecting flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Verifica um flow
   */
  async verifyFlow(req, res) {
    try {
      const { flowId } = req.params;
      const moderatorId = req.user.userId;

      const result = await moderationService.verifyFlow(flowId, moderatorId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error verifying flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém estatísticas de moderação
   */
  async getModerationStats(req, res) {
    try {
      const result = await moderationService.getModerationStats();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting moderation stats:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Lista todos os flows públicos aprovados (moderadores)
   */
  async listAllPublicFlows(req, res) {
    try {
      const filters = {
        search: req.query.search,
        category: req.query.category,
        verified: req.query.verified,
        sortBy: req.query.sortBy || 'recent'
      };

      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
      };

      const result = await moderationService.listAllPublicFlows(filters, pagination);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error listing all public flows:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Remove verificação de um flow (moderadores)
   */
  async unverifyFlow(req, res) {
    try {
      const { flowId } = req.params;
      const moderatorId = req.user.userId;

      const result = await moderationService.unverifyFlow(flowId, moderatorId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error unverifying flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Move flow para quarentena (moderadores)
   */
  async quarantineFlow(req, res) {
    try {
      const { flowId } = req.params;
      const moderatorId = req.user.userId;
      const { reason } = req.body;

      const result = await moderationService.quarantineFlow(flowId, moderatorId, reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error quarantining flow:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }
}

module.exports = new PublicFlowController();

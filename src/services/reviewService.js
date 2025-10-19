const FlowReview = require('../models/FlowReview');
const Flow = require('../models/Flow');
const User = require('../models/User');
const logger = require('../utils/logger');
const { formatSuccess, formatError } = require('../utils/helpers');

class ReviewService {
  /**
   * Cria uma review para um flow público
   */
  async createReview(flowId, userId, reviewData) {
    try {
      const { rating, title, comment } = reviewData;

      // Verificar se flow existe e é público
      const flow = await Flow.findOne({
        _id: flowId,
        isPublic: true,
        'publicationData.status': 'approved'
      });

      if (!flow) {
        return formatError('Flow não encontrado ou não está público', 'FLOW_NOT_FOUND');
      }

      // Verificar se usuário é o dono do flow
      if (flow.userId.toString() === userId.toString()) {
        return formatError('Você não pode avaliar seu próprio flow', 'CANNOT_REVIEW_OWN_FLOW');
      }

      // Verificar se já existe review deste usuário
      const existingReview = await FlowReview.findOne({ flowId, userId });
      if (existingReview) {
        return formatError('Você já avaliou este flow. Use a opção de editar.', 'REVIEW_ALREADY_EXISTS');
      }

      // Criar review
      const review = new FlowReview({
        flowId,
        userId,
        rating,
        title,
        comment
      });

      await review.save();

      // Atualizar estatísticas do flow
      await this.updateFlowRatingStats(flowId);

      // Popular usuário para retorno
      await review.populate('userId', 'name publicProfile.displayName publicProfile.avatar');

      logger.info(`Review created for flow ${flowId} by user ${userId}`);

      return formatSuccess(review, 'Avaliação criada com sucesso');
    } catch (error) {
      logger.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma review existente
   */
  async updateReview(reviewId, userId, updateData) {
    try {
      const review = await FlowReview.findOne({ _id: reviewId, userId });

      if (!review) {
        return formatError('Avaliação não encontrada', 'REVIEW_NOT_FOUND');
      }

      // Atualizar campos permitidos
      if (updateData.rating !== undefined) review.rating = updateData.rating;
      if (updateData.title !== undefined) review.title = updateData.title;
      if (updateData.comment !== undefined) review.comment = updateData.comment;

      await review.save();

      // Atualizar estatísticas do flow
      await this.updateFlowRatingStats(review.flowId);

      await review.populate('userId', 'name publicProfile.displayName publicProfile.avatar');

      logger.info(`Review ${reviewId} updated by user ${userId}`);

      return formatSuccess(review, 'Avaliação atualizada com sucesso');
    } catch (error) {
      logger.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Deleta uma review
   */
  async deleteReview(reviewId, userId) {
    try {
      const review = await FlowReview.findOne({ _id: reviewId, userId });

      if (!review) {
        return formatError('Avaliação não encontrada', 'REVIEW_NOT_FOUND');
      }

      const flowId = review.flowId;
      await review.deleteOne();

      // Atualizar estatísticas do flow
      await this.updateFlowRatingStats(flowId);

      logger.info(`Review ${reviewId} deleted by user ${userId}`);

      return formatSuccess(null, 'Avaliação deletada com sucesso');
    } catch (error) {
      logger.error('Error deleting review:', error);
      throw error;
    }
  }

  /**
   * Lista reviews de um flow
   */
  async listFlowReviews(flowId, options = {}) {
    try {
      const {
        sortBy = 'helpful',
        page = 1,
        limit = 10,
        minRating = null
      } = options;

      const query = {
        flowId,
        moderationStatus: 'active'
      };

      if (minRating) {
        query.rating = { $gte: minRating };
      }

      let sort = {};
      switch (sortBy) {
        case 'helpful':
          sort = { helpful: -1, createdAt: -1 };
          break;
        case 'recent':
          sort = { createdAt: -1 };
          break;
        case 'rating_high':
          sort = { rating: -1, createdAt: -1 };
          break;
        case 'rating_low':
          sort = { rating: 1, createdAt: -1 };
          break;
        default:
          sort = { helpful: -1 };
      }

      const skip = (page - 1) * limit;

      const [reviews, total] = await Promise.all([
        FlowReview.find(query)
          .populate('userId', 'name publicProfile.displayName publicProfile.avatar publicProfile.isVerifiedCreator')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        FlowReview.countDocuments(query)
      ]);

      return formatSuccess({
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing reviews:', error);
      throw error;
    }
  }

  /**
   * Marca uma review como útil
   */
  async markReviewAsHelpful(reviewId, userId) {
    try {
      const review = await FlowReview.findById(reviewId);

      if (!review) {
        return formatError('Avaliação não encontrada', 'REVIEW_NOT_FOUND');
      }

      // Verificar se usuário já marcou como útil
      if (review.helpfulBy.includes(userId)) {
        // Desmarcar
        await review.unmarkAsHelpful(userId);
        return formatSuccess({ helpful: review.helpful, marked: false }, 'Desmarcado como útil');
      } else {
        // Marcar
        await review.markAsHelpful(userId);
        return formatSuccess({ helpful: review.helpful, marked: true }, 'Marcado como útil');
      }
    } catch (error) {
      logger.error('Error marking review as helpful:', error);
      throw error;
    }
  }

  /**
   * Atualiza estatísticas de rating de um flow
   */
  async updateFlowRatingStats(flowId) {
    try {
      const reviews = await FlowReview.find({
        flowId,
        moderationStatus: 'active'
      });

      if (reviews.length === 0) {
        await Flow.updateOne(
          { _id: flowId },
          {
            $set: {
              'publicStats.averageRating': 0,
              'publicStats.totalRatings': 0,
              'publicStats.totalReviews': 0,
              'publicStats.ratingDistribution': { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
            }
          }
        );
        return;
      }

      // Calcular média
      const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = totalRating / reviews.length;

      // Calcular distribuição
      const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach(review => {
        ratingDistribution[review.rating]++;
      });

      // Atualizar flow
      await Flow.updateOne(
        { _id: flowId },
        {
          $set: {
            'publicStats.averageRating': Math.round(averageRating * 10) / 10,
            'publicStats.totalRatings': reviews.length,
            'publicStats.totalReviews': reviews.length,
            'publicStats.ratingDistribution': ratingDistribution
          }
        }
      );

      // Atualizar rating médio do autor
      const flow = await Flow.findById(flowId);
      if (flow && flow.publicMetadata?.author?.userId) {
        const authorFlows = await Flow.find({
          'publicMetadata.author.userId': flow.publicMetadata.author.userId,
          isPublic: true,
          'publicationData.status': 'approved'
        }).select('publicStats.averageRating publicStats.totalRatings');

        if (authorFlows.length > 0) {
          const totalRatings = authorFlows.reduce((sum, f) => sum + (f.publicStats?.totalRatings || 0), 0);
          const weightedSum = authorFlows.reduce(
            (sum, f) => sum + ((f.publicStats?.averageRating || 0) * (f.publicStats?.totalRatings || 0)),
            0
          );
          const authorAvgRating = totalRatings > 0 ? weightedSum / totalRatings : 0;

          await User.updateOne(
            { _id: flow.publicMetadata.author.userId },
            { $set: { 'publicProfile.publicStats.averageRating': Math.round(authorAvgRating * 10) / 10 } }
          );
        }
      }

      logger.info(`Rating stats updated for flow ${flowId}`);
    } catch (error) {
      logger.error('Error updating rating stats:', error);
      throw error;
    }
  }

  /**
   * Obtém review de um usuário específico para um flow
   */
  async getUserReview(flowId, userId) {
    try {
      const review = await FlowReview.findOne({ flowId, userId })
        .populate('userId', 'name publicProfile.displayName publicProfile.avatar')
        .lean();

      if (!review) {
        return formatSuccess(null);
      }

      return formatSuccess(review);
    } catch (error) {
      logger.error('Error getting user review:', error);
      throw error;
    }
  }
}

module.exports = new ReviewService();

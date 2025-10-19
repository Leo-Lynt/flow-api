const User = require('../models/User');
const { formatError, formatSuccess } = require('../utils/helpers');
const logger = require('../utils/logger');

class UserManagementController {
  /**
   * Lista todos os usuários (apenas admin)
   */
  async listUsers(req, res) {
    try {
      const { page = 1, limit = 20, role, search } = req.query;

      const query = {};

      if (role && ['user', 'moderator', 'administrator'].includes(role)) {
        query.role = role;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        User.find(query)
          .select('name email role isVerified isActive createdAt publicProfile.isVerifiedCreator')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(query)
      ]);

      res.json(formatSuccess({
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }));
    } catch (error) {
      logger.error('Error listing users:', error);
      res.status(500).json(formatError('Erro ao listar usuários', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém detalhes de um usuário
   */
  async getUserDetails(req, res) {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('-password -refreshToken -twoFactorSecret -verificationToken -resetPasswordToken -twoFactorBackupCodes -activeSessions')
        .lean();

      if (!user) {
        return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
      }

      res.json(formatSuccess(user));
    } catch (error) {
      logger.error('Error getting user details:', error);
      res.status(500).json(formatError('Erro ao buscar usuário', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Atualiza o role de um usuário (apenas admin)
   */
  async updateUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const adminUser = req.currentUser;

      // Validar role
      if (!['user', 'moderator', 'administrator'].includes(role)) {
        return res.status(400).json(formatError('Role inválido', 'INVALID_ROLE'));
      }

      // Buscar usuário alvo
      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
      }

      // Não pode mudar o próprio role
      if (targetUser._id.toString() === adminUser._id.toString()) {
        return res.status(400).json(formatError('Você não pode alterar seu próprio role', 'CANNOT_MODIFY_SELF'));
      }

      // Verificar se pode promover para esse role
      if (!adminUser.canPromoteToRole(role)) {
        return res.status(403).json(formatError('Você não tem permissão para atribuir esse role', 'INSUFFICIENT_PERMISSIONS'));
      }

      // Atualizar role
      const oldRole = targetUser.role;
      targetUser.role = role;
      await targetUser.save();

      logger.info(`User ${adminUser._id} changed role of user ${userId} from ${oldRole} to ${role}`);

      res.json(formatSuccess({
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role
        },
        oldRole,
        newRole: role
      }, 'Role atualizado com sucesso'));
    } catch (error) {
      logger.error('Error updating user role:', error);
      res.status(500).json(formatError('Erro ao atualizar role', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Ativa ou desativa um usuário (apenas admin)
   */
  async toggleUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      const adminUser = req.currentUser;

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
      }

      // Não pode desativar a si mesmo
      if (targetUser._id.toString() === adminUser._id.toString()) {
        return res.status(400).json(formatError('Você não pode desativar sua própria conta', 'CANNOT_MODIFY_SELF'));
      }

      targetUser.isActive = isActive;
      if (!isActive) {
        targetUser.deletedAt = new Date();
      } else {
        targetUser.deletedAt = null;
      }
      await targetUser.save();

      logger.info(`User ${adminUser._id} set isActive=${isActive} for user ${userId}`);

      res.json(formatSuccess({
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          isActive: targetUser.isActive
        }
      }, `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso`));
    } catch (error) {
      logger.error('Error toggling user status:', error);
      res.status(500).json(formatError('Erro ao alterar status do usuário', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Marca/desmarca usuário como criador verificado
   */
  async toggleVerifiedCreator(req, res) {
    try {
      const { userId } = req.params;
      const { isVerified } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
      }

      user.publicProfile = user.publicProfile || {};
      user.publicProfile.isVerifiedCreator = isVerified;
      await user.save();

      logger.info(`User ${userId} verified creator status set to ${isVerified}`);

      res.json(formatSuccess({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isVerifiedCreator: user.publicProfile.isVerifiedCreator
        }
      }, `Criador ${isVerified ? 'verificado' : 'desverificado'} com sucesso`));
    } catch (error) {
      logger.error('Error toggling verified creator:', error);
      res.status(500).json(formatError('Erro ao alterar status de criador verificado', 'INTERNAL_ERROR'));
    }
  }

  /**
   * Obtém estatísticas de usuários
   */
  async getUserStats(req, res) {
    try {
      const [totalUsers, usersByRole, activeUsers, verifiedUsers] = await Promise.all([
        User.countDocuments(),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ isVerified: true })
      ]);

      const roleStats = usersByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      res.json(formatSuccess({
        totalUsers,
        activeUsers,
        verifiedUsers,
        roleStats: {
          user: roleStats.user || 0,
          moderator: roleStats.moderator || 0,
          administrator: roleStats.administrator || 0
        }
      }));
    } catch (error) {
      logger.error('Error getting user stats:', error);
      res.status(500).json(formatError('Erro ao buscar estatísticas', 'INTERNAL_ERROR'));
    }
  }
}

module.exports = new UserManagementController();

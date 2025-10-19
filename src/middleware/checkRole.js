const { formatError } = require('../utils/helpers');
const User = require('../models/User');

/**
 * Middleware genérico para verificar role mínimo do usuário
 * @param {string} minimumRole - Role mínimo necessário ('user', 'moderator', 'administrator')
 */
const checkRole = (minimumRole) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json(formatError('Não autenticado', 'UNAUTHORIZED'));
      }

      const user = await User.findById(userId).select('role');

      if (!user) {
        return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
      }

      // Verifica se o usuário tem o role mínimo necessário
      if (!user.hasMinimumRole(minimumRole)) {
        const roleNames = {
          user: 'usuário',
          moderator: 'moderador',
          administrator: 'administrador'
        };
        return res.status(403).json(
          formatError(
            `Acesso negado. É necessário ser ${roleNames[minimumRole]} ou superior`,
            'INSUFFICIENT_PERMISSIONS'
          )
        );
      }

      // Adiciona o usuário completo ao request para uso posterior
      req.currentUser = user;

      next();
    } catch (error) {
      console.error('Error in checkRole middleware:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  };
};

/**
 * Middleware para verificar se usuário é administrador
 */
const isAdministrator = checkRole('administrator');

/**
 * Middleware para verificar se usuário é moderador ou superior
 */
const isModerator = checkRole('moderator');

module.exports = {
  checkRole,
  isAdministrator,
  isModerator
};

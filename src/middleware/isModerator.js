const { formatError } = require('../utils/helpers');
const User = require('../models/User');

/**
 * Middleware para verificar se usuário tem permissão de moderador ou superior
 */
const isModerator = async (req, res, next) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json(formatError('Não autenticado', 'UNAUTHORIZED'));
    }

    const user = await User.findById(userId).select('role');

    if (!user) {
      return res.status(404).json(formatError('Usuário não encontrado', 'USER_NOT_FOUND'));
    }

    // Verifica se o usuário é moderador ou administrador
    if (!user.isModerator()) {
      return res.status(403).json(formatError('Acesso negado. Apenas moderadores e administradores podem acessar', 'FORBIDDEN'));
    }

    // Adiciona o usuário completo ao request para uso posterior
    req.currentUser = user;

    next();
  } catch (error) {
    console.error('Error in isModerator middleware:', error);
    return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
  }
};

module.exports = isModerator;

const authService = require('../services/authService');
const oauthService = require('../services/oauthService');
const { formatError, formatSuccess } = require('../utils/helpers');

class AuthController {
  // Login com Google (Sign in with Google)
  async googleLogin(req, res) {
    try {
      const { state } = req.query;

      // Gerar userId temporário (será ignorado no fluxo de authentication)
      const tempUserId = 'anonymous';

      const options = {
        scopes: ['profile'], // Apenas profile (email + nome)
        purpose: 'authentication',
        serviceType: null
      };

      const authUrl = oauthService.getAuthorizationUrl('google', tempUserId, state, options);

      return res.status(200).json(formatSuccess({
        authUrl
      }, 'Redirecione o usuário para esta URL'));

    } catch (error) {
      console.error('Erro ao gerar URL de login Google:', error);
      return res.status(400).json(formatError(error.message, 'GOOGLE_LOGIN_ERROR'));
    }
  }
  // Registrar usuário
  async register(req, res) {
    try {
      const result = await authService.register(req.body);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(201).json(result);
    } catch (error) {
      console.error('Erro no registro:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Login
  async login(req, res) {
    try {
      console.log('[AuthController] Login attempt for:', req.body.email);
      const result = await authService.login(req.body);
      console.log('[AuthController] Login result success:', result.success);

      if (!result.success) {
        return res.status(401).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro no login:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Refresh token
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);

      if (!result.success) {
        return res.status(401).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro no refresh token:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const result = await authService.logout(req.user.userId);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro no logout:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter perfil
  async getProfile(req, res) {
    try {
      const result = await authService.getProfile(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter perfil:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Atualizar perfil
  async updateProfile(req, res) {
    try {
      const result = await authService.updateProfile(req.user.userId, req.body);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Alterar senha
  async changePassword(req, res) {
    try {
      const result = await authService.changePassword(req.user.userId, req.body);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 :
                      result.error.code === 'INVALID_CURRENT_PASSWORD' ? 400 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Enviar email de verificação
  async sendVerificationEmail(req, res) {
    try {
      const result = await authService.sendVerificationEmail(req.user.userId);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 :
                      result.error.code === 'EMAIL_ALREADY_VERIFIED' ? 400 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao enviar email de verificação:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Verificar email
  async verifyEmail(req, res) {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao verificar email:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Solicitar reset de senha
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao solicitar reset de senha:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Redefinir senha
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter preferências
  async getPreferences(req, res) {
    try {
      const result = await authService.getPreferences(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter preferências:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Atualizar preferências
  async updatePreferences(req, res) {
    try {
      const result = await authService.updatePreferences(req.user.userId, req.body);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao atualizar preferências:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Deletar conta
  async deleteAccount(req, res) {
    try {
      const { password, confirmation } = req.body;
      const result = await authService.deleteAccount(req.user.userId, password, confirmation);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao deletar conta:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter estatísticas do perfil
  async getProfileStats(req, res) {
    try {
      const result = await authService.getProfileStats(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter estatísticas do dashboard
  async getDashboardStats(req, res) {
    try {
      const result = await authService.getDashboardStats(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter estatísticas do dashboard:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter sessões ativas
  async getActiveSessions(req, res) {
    try {
      const result = await authService.getActiveSessions(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter sessões:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Revogar sessão específica
  async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const result = await authService.revokeSession(req.user.userId, sessionId);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 :
                      result.error.code === 'SESSION_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao revogar sessão:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Revogar todas as sessões
  async revokeAllSessions(req, res) {
    try {
      const currentToken = req.headers.authorization?.substring(7);
      const result = await authService.revokeAllSessions(req.user.userId, currentToken);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao revogar todas as sessões:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Obter contas conectadas
  async getConnectedAccounts(req, res) {
    try {
      const result = await authService.getConnectedAccounts(req.user.userId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao obter contas conectadas:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Ativar 2FA
  async enable2FA(req, res) {
    try {
      const { password } = req.body;
      const result = await authService.enable2FA(req.user.userId, password);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao ativar 2FA:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Verificar 2FA
  async verify2FA(req, res) {
    try {
      const { token } = req.body;
      const result = await authService.verify2FA(req.user.userId, token);

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao verificar 2FA:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Desativar 2FA
  async disable2FA(req, res) {
    try {
      const { password, token } = req.body;
      const result = await authService.disable2FA(req.user.userId, password, token);

      if (!result.success) {
        const status = result.error.code === 'USER_NOT_FOUND' ? 404 : 400;
        return res.status(status).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao desativar 2FA:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }

  // Verificar 2FA no login
  async verify2FALogin(req, res) {
    try {
      const { tempToken, token } = req.body;
      const result = await authService.verify2FALogin(tempToken, token);

      if (!result.success) {
        return res.status(401).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Erro ao verificar 2FA no login:', error);
      return res.status(500).json(formatError('Erro interno do servidor', 'INTERNAL_ERROR'));
    }
  }
}

module.exports = new AuthController();
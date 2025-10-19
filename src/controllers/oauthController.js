const oauthService = require('../services/oauthService');
const { formatError, formatSuccess } = require('../utils/helpers');

class OAuthController {
  // Iniciar fluxo OAuth
  async authorize(req, res) {
    try {
      const { provider } = req.params;
      const userId = req.user.userId;
      const { state, scopes, purpose, serviceType } = req.query;

      // Novo formato com scopes dinâmicos
      if (provider === 'google') {
        const scopesArray = scopes ? scopes.split(',').map(s => s.trim()) : [];

        const options = {
          scopes: scopesArray,
          purpose: purpose || 'connection',
          serviceType: serviceType || null
        };

        const authUrl = oauthService.getAuthorizationUrl(provider, userId, state, options);

        return res.status(200).json(formatSuccess({
          authUrl,
          provider,
          purpose: options.purpose,
          serviceType: options.serviceType
        }, 'URL de autorização gerada'));
      }

      // Retrocompatibilidade (DEPRECATED)
      const authUrl = oauthService.getAuthorizationUrl(provider, userId, state);

      return res.status(200).json(formatSuccess({
        authUrl,
        provider
      }, 'URL de autorização gerada (DEPRECATED: use provider=google com scopes)'));

    } catch (error) {
      console.error('Erro ao gerar URL de autorização:', error);
      return res.status(400).json(formatError(error.message, 'OAUTH_ERROR'));
    }
  }

  // Callback OAuth (depois da autorização)
  async callback(req, res) {
    try {
      const { provider } = req.params;
      const { code, state, error } = req.query;

      // Se houve erro na autorização
      if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}/connections?error=${error}`);
      }

      if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}/connections?error=no_code`);
      }

      // Decodificar state para pegar userId e purpose
      const stateDecoded = Buffer.from(state, 'base64').toString('utf8');
      const stateData = JSON.parse(stateDecoded);
      const { userId, purpose = 'connection', serviceType } = stateData;

      // Trocar code por tokens
      const result = await oauthService.exchangeCodeForTokens(provider, code, userId, stateData);

      // Redirecionar conforme purpose
      if (purpose === 'authentication') {
        // Login social - redirecionar para /auth/callback com token
        return res.redirect(
          `${process.env.FRONTEND_URL}/auth/callback?success=true&token=${result.token}&email=${result.email}`
        );
      } else {
        // Connection - redirecionar para /connections
        return res.redirect(
          `${process.env.FRONTEND_URL}/connections?success=true&provider=${provider}&serviceType=${serviceType || 'generic'}&email=${result.email}`
        );
      }

    } catch (error) {
      console.error('Erro no callback OAuth:', error);
      return res.redirect(
        `${process.env.FRONTEND_URL}/connections?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  // Listar conexões do usuário
  async listConnections(req, res) {
    try {
      const userId = req.user.userId;
      const { provider } = req.query;

      const connections = await oauthService.listUserConnections(userId, provider);

      return res.status(200).json(formatSuccess({
        connections,
        total: connections.length
      }, 'Conexões obtidas com sucesso'));

    } catch (error) {
      console.error('Erro ao listar conexões:', error);
      return res.status(500).json(formatError('Erro ao listar conexões', 'INTERNAL_ERROR'));
    }
  }

  // Obter conexão específica
  async getConnection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const connection = await Connection.findActiveConnection(id, userId);

      if (!connection) {
        return res.status(404).json(formatError('Conexão não encontrada', 'CONNECTION_NOT_FOUND'));
      }

      return res.status(200).json(formatSuccess(connection, 'Conexão obtida com sucesso'));

    } catch (error) {
      console.error('Erro ao obter conexão:', error);
      return res.status(500).json(formatError('Erro ao obter conexão', 'INTERNAL_ERROR'));
    }
  }

  // Renovar token manualmente
  async refreshToken(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      const connection = await oauthService.refreshAccessToken(id, userId);

      return res.status(200).json(formatSuccess({
        connectionId: connection._id,
        expiresAt: connection.expiresAt
      }, 'Token renovado com sucesso'));

    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return res.status(400).json(formatError(error.message, 'REFRESH_ERROR'));
    }
  }

  // Revogar/deletar conexão
  async revokeConnection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      await oauthService.revokeConnection(id, userId);

      return res.status(200).json(formatSuccess(null, 'Conexão revogada com sucesso'));

    } catch (error) {
      console.error('Erro ao revogar conexão:', error);
      return res.status(400).json(formatError(error.message, 'REVOKE_ERROR'));
    }
  }

  // Testar conexão
  async testConnection(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;

      // Tentar obter access token válido (faz refresh se necessário)
      const accessToken = await oauthService.getValidAccessToken(id, userId);

      if (!accessToken) {
        return res.status(400).json(formatError('Token inválido', 'INVALID_TOKEN'));
      }

      return res.status(200).json(formatSuccess({
        status: 'active',
        message: 'Conexão funcionando corretamente'
      }, 'Teste realizado com sucesso'));

    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      return res.status(400).json(formatError(error.message, 'TEST_ERROR'));
    }
  }
}

module.exports = new OAuthController();
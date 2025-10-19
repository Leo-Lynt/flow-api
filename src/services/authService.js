const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const Flow = require('../models/Flow');
const FlowExecution = require('../models/FlowExecution');
const FlowSchedule = require('../models/FlowSchedule');
const Connection = require('../models/Connection');
const { formatError, formatSuccess, sanitizeUser } = require('../utils/helpers');
const tokenService = require('./tokenService');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class AuthService {
  // Gerar JWT token
  generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
  }

  // Gerar refresh token
  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });
  }

  // Verificar JWT token
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido');
    }
  }

  // Verificar refresh token
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      throw new Error('Refresh token inválido');
    }
  }

  // Registrar usuário
  async register(userData) {
    try {
      const { email, password, name } = userData;

      // Verificar se usuário já existe
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return formatError('Email já está em uso', 'EMAIL_ALREADY_EXISTS');
      }

      // Criar usuário
      const user = new User({ email, password, name });
      await user.save();

      // Gerar tokens
      const payload = { userId: user._id, email: user.email, role: user.role };
      const accessToken = this.generateToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      // Salvar refresh token
      user.refreshToken = refreshToken;
      await user.save();

      return formatSuccess({
        user: sanitizeUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }, 'Usuário registrado com sucesso');

    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return formatError(errors.join(', '), 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Login
  async login(credentials) {
    try {
      const { email, password } = credentials;

      // Buscar usuário com senha, 2FA e campos de bloqueio
      const user = await User.findOne({ email }).select('+password +twoFactorEnabled +twoFactorSecret +loginAttempts +lockUntil');
      if (!user) {
        return formatError('Credenciais inválidas', 'INVALID_CREDENTIALS');
      }

      // Verificar se conta está bloqueada
      if (user.isLocked()) {
        const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
        return formatError(
          `Conta bloqueada por muitas tentativas. Tente novamente em ${remainingTime} minutos`,
          'ACCOUNT_LOCKED',
          { remainingMinutes: remainingTime }
        );
      }

      // Verificar senha
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        // Incrementar tentativas falhadas
        await user.incrementLoginAttempts();

        const attemptsLeft = 5 - (user.loginAttempts + 1);
        if (attemptsLeft > 0) {
          return formatError(
            `Credenciais inválidas. ${attemptsLeft} tentativas restantes`,
            'INVALID_CREDENTIALS',
            { attemptsLeft }
          );
        } else {
          return formatError(
            'Credenciais inválidas. Conta bloqueada por 30 minutos',
            'INVALID_CREDENTIALS',
            { attemptsLeft: 0 }
          );
        }
      }

      // Resetar tentativas de login em caso de sucesso
      await user.resetLoginAttempts();

      // Se 2FA está habilitado, retornar que é necessário verificação
      if (user.twoFactorEnabled) {
        // Gerar token temporário para verificação 2FA (válido por 5 minutos)
        const tempToken = jwt.sign(
          { userId: user._id, email: user.email, purpose: '2fa-verification' },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );

        // Salvar tempToken no usuário para validação posterior
        user.twoFactorTempToken = tempToken;
        await user.save();

        return formatSuccess({
          requires2FA: true,
          tempToken,
          message: 'Two-factor authentication required'
        }, 'Verificação de dois fatores necessária');
      }

      // Se não tem 2FA, fazer login normalmente
      console.log('[AuthService] User role:', user.role);
      const payload = { userId: user._id, email: user.email, role: user.role };
      console.log('[AuthService] JWT Payload:', payload);
      const accessToken = this.generateToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      // Salvar refresh token e sessão
      user.refreshToken = refreshToken;
      user.lastLoginAt = new Date(); // Atualizar último login

      // Adicionar sessão ativa
      const sessionId = crypto.randomBytes(16).toString('hex');
      user.activeSessions.push({
        sessionId,
        token: refreshToken,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: null, // Será definido no controller
        userAgent: null  // Será definido no controller
      });

      await user.save();

      return formatSuccess({
        user: sanitizeUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }, 'Login realizado com sucesso');

    } catch (error) {
      throw error;
    }
  }

  // Verificar 2FA no login e completar autenticação
  async verify2FALogin(tempToken, token) {
    try {
      // Verificar token temporário
      let decoded;
      try {
        decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decoded.purpose !== '2fa-verification') {
          return formatError('Token inválido', 'INVALID_TOKEN');
        }
      } catch (error) {
        return formatError('Token expirado ou inválido', 'INVALID_TOKEN');
      }

      // Buscar usuário com campos de bloqueio 2FA
      const user = await User.findById(decoded.userId).select('+twoFactorSecret +twoFactorEnabled +twoFactorAttempts +twoFactorLockUntil +twoFactorTempToken');
      if (!user || !user.twoFactorEnabled) {
        return formatError('Usuário não encontrado ou 2FA não habilitado', 'INVALID_USER');
      }

      // Verificar se 2FA está bloqueado
      if (user.is2FALocked()) {
        const remainingTime = Math.ceil((user.twoFactorLockUntil - Date.now()) / 60000);
        return formatError(
          `Muitas tentativas de 2FA. Tente novamente em ${remainingTime} minutos`,
          '2FA_LOCKED',
          { remainingMinutes: remainingTime }
        );
      }

      // Validar que o tempToken corresponde ao usuário
      if (user.twoFactorTempToken && user.twoFactorTempToken !== tempToken) {
        return formatError('Token de sessão inválido', 'INVALID_SESSION');
      }

      // Verificar código TOTP
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Permite 1 código anterior e 1 posterior (60 segundos de tolerância)
      });

      if (!verified) {
        // Incrementar tentativas falhadas
        await user.increment2FAAttempts();

        const attemptsLeft = 5 - (user.twoFactorAttempts + 1);
        if (attemptsLeft > 0) {
          return formatError(
            `Código de verificação inválido. ${attemptsLeft} tentativas restantes`,
            'INVALID_2FA_CODE',
            { attemptsLeft }
          );
        } else {
          return formatError(
            'Código de verificação inválido. Conta bloqueada por 15 minutos',
            'INVALID_2FA_CODE',
            { attemptsLeft: 0 }
          );
        }
      }

      // Código correto - resetar tentativas
      await user.reset2FAAttempts();

      // Gerar tokens de autenticação completos
      const payload = { userId: user._id, email: user.email, role: user.role };
      const accessToken = this.generateToken(payload);
      const refreshToken = this.generateRefreshToken(payload);

      // Salvar refresh token e sessão
      user.refreshToken = refreshToken;
      user.lastLoginAt = new Date(); // Atualizar último login após 2FA

      // Adicionar sessão ativa
      const sessionId = crypto.randomBytes(16).toString('hex');
      user.activeSessions.push({
        sessionId,
        token: refreshToken,
        createdAt: new Date(),
        lastActivity: new Date(),
        ipAddress: null,
        userAgent: null
      });

      await user.save();

      return formatSuccess({
        user: sanitizeUser(user),
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }, 'Login realizado com sucesso');

    } catch (error) {
      logger.error('Erro ao verificar 2FA no login:', error);
      throw error;
    }
  }

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      // Verificar refresh token
      const decoded = this.verifyRefreshToken(refreshToken);

      // Buscar usuário
      const user = await User.findById(decoded.userId).select('+refreshToken');
      if (!user || user.refreshToken !== refreshToken) {
        return formatError('Refresh token inválido', 'INVALID_REFRESH_TOKEN');
      }

      // Gerar novos tokens
      const payload = { userId: user._id, email: user.email, role: user.role };
      const accessToken = this.generateToken(payload);
      const newRefreshToken = this.generateRefreshToken(payload);

      // Atualizar refresh token
      user.refreshToken = newRefreshToken;
      await user.save();

      return formatSuccess({
        tokens: {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h'
        }
      }, 'Token renovado com sucesso');

    } catch (error) {
      return formatError('Refresh token inválido', 'INVALID_REFRESH_TOKEN');
    }
  }

  // Logout
  async logout(userId) {
    try {
      const user = await User.findById(userId);
      if (user) {
        user.refreshToken = null;
        await user.save();
      }

      return formatSuccess(null, 'Logout realizado com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Obter perfil do usuário
  async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      return formatSuccess(sanitizeUser(user), 'Perfil obtido com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Atualizar perfil
  async updateProfile(userId, updateData) {
    try {
      // Email não pode ser alterado - apenas name é permitido
      const allowedUpdates = ['name'];
      const updates = {};

      // Filtrar campos permitidos
      for (const key of allowedUpdates) {
        if (updateData[key] !== undefined) {
          updates[key] = updateData[key];
        }
      }

      // Avisar se tentou alterar email
      if (updateData.email !== undefined) {
        return formatError('Email não pode ser alterado', 'EMAIL_IMMUTABLE');
      }

      const user = await User.findByIdAndUpdate(
        userId,
        updates,
        { new: true, runValidators: true }
      );

      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      return formatSuccess(sanitizeUser(user), 'Perfil atualizado com sucesso');
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return formatError(errors.join(', '), 'VALIDATION_ERROR');
      }
      if (error.code === 11000) {
        return formatError('Já existe um usuário com essas informações', 'DUPLICATE_ERROR');
      }
      throw error;
    }
  }

  // Alterar senha
  async changePassword(userId, passwordData) {
    try {
      const { currentPassword, newPassword } = passwordData;

      const user = await User.findById(userId).select('+password');
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Verificar senha atual
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return formatError('Senha atual incorreta', 'INVALID_CURRENT_PASSWORD');
      }

      // Atualizar senha
      user.password = newPassword;
      user.lastPasswordChange = new Date();
      await user.save();

      // Enviar email de notificação (opcional, não bloquear se falhar)
      try {
        await emailService.sendPasswordChangedEmail(user);
      } catch (emailError) {
        logger.error('Failed to send password changed email:', emailError);
      }

      return formatSuccess(null, 'Senha alterada com sucesso');
    } catch (error) {
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return formatError(errors.join(', '), 'VALIDATION_ERROR');
      }
      throw error;
    }
  }

  // Enviar email de verificação
  async sendVerificationEmail(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      if (user.isVerified) {
        return formatError('Email já está verificado', 'EMAIL_ALREADY_VERIFIED');
      }

      // Gerar token de verificação
      const { token, hashedToken, expires } = tokenService.generateVerificationToken();

      // Salvar token hasheado no banco
      user.verificationToken = hashedToken;
      user.verificationTokenExpires = expires;
      await user.save();

      // Enviar email
      await emailService.sendVerificationEmail(user, token);

      return formatSuccess(null, 'Email de verificação enviado com sucesso');
    } catch (error) {
      logger.error('Error sending verification email:', error);
      throw error;
    }
  }

  // Verificar email
  async verifyEmail(token) {
    try {
      const hashedToken = tokenService.hashToken(token);

      const user = await User.findOne({
        verificationToken: hashedToken,
        verificationTokenExpires: { $gt: Date.now() }
      });

      if (!user) {
        return formatError('Token inválido ou expirado', 'INVALID_TOKEN');
      }

      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpires = undefined;
      await user.save();

      return formatSuccess(null, 'Email verificado com sucesso');
    } catch (error) {
      logger.error('Error verifying email:', error);
      throw error;
    }
  }

  // Solicitar reset de senha
  async forgotPassword(email) {
    try {
      const user = await User.findOne({ email });

      // Não revelar se o email existe ou não por segurança
      if (!user) {
        return formatSuccess(null, 'Se o email existir, você receberá instruções para redefinir sua senha');
      }

      // Gerar token de reset
      const { token, hashedToken, expires } = tokenService.generateResetPasswordToken();

      // Salvar token hasheado no banco
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = expires;
      await user.save();

      // Enviar email
      await emailService.sendResetPasswordEmail(user, token);

      return formatSuccess(null, 'Se o email existir, você receberá instruções para redefinir sua senha');
    } catch (error) {
      logger.error('Error in forgot password:', error);
      throw error;
    }
  }

  // Redefinir senha
  async resetPassword(token, newPassword) {
    try {
      const hashedToken = tokenService.hashToken(token);

      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
      }).select('+password');

      if (!user) {
        return formatError('Token inválido ou expirado', 'INVALID_TOKEN');
      }

      // Atualizar senha
      user.password = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      user.lastPasswordChange = new Date();
      await user.save();

      // Enviar email de confirmação
      try {
        await emailService.sendPasswordChangedEmail(user);
      } catch (emailError) {
        logger.error('Failed to send password changed email:', emailError);
      }

      return formatSuccess(null, 'Senha redefinida com sucesso');
    } catch (error) {
      logger.error('Error resetting password:', error);
      throw error;
    }
  }

  // Obter preferências do usuário
  async getPreferences(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      return formatSuccess(user.preferences, 'Preferências obtidas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Atualizar preferências
  async updatePreferences(userId, preferencesData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Atualizar apenas campos fornecidos
      Object.keys(preferencesData).forEach(key => {
        if (user.preferences[key] !== undefined) {
          user.preferences[key] = preferencesData[key];
        }
      });

      await user.save();

      return formatSuccess(user.preferences, 'Preferências atualizadas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Deletar conta
  async deleteAccount(userId, password, confirmation) {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Verificar senha (se não for login social)
      if (user.provider === 'local') {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          return formatError('Senha incorreta', 'INVALID_PASSWORD');
        }
      }

      // Verificar confirmação
      if (confirmation !== 'DELETE') {
        return formatError('Confirmação inválida. Digite "DELETE" para confirmar', 'INVALID_CONFIRMATION');
      }

      // Deletar dados relacionados
      await Flow.deleteMany({ userId: user._id });
      await FlowExecution.deleteMany({ userId: user._id });
      await FlowSchedule.deleteMany({ userId: user._id });
      await Connection.deleteMany({ userId: user._id });

      // Soft delete ou hard delete
      if (process.env.SOFT_DELETE === 'true') {
        user.isActive = false;
        user.deletedAt = new Date();
        await user.save();
      } else {
        await User.findByIdAndDelete(userId);
      }

      // Enviar email de confirmação
      try {
        await emailService.sendAccountDeletedEmail(user);
      } catch (emailError) {
        logger.error('Failed to send account deleted email:', emailError);
      }

      return formatSuccess(null, 'Conta deletada com sucesso');
    } catch (error) {
      logger.error('Error deleting account:', error);
      throw error;
    }
  }

  // Obter estatísticas do perfil
  async getProfileStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      const flowsCount = await Flow.countDocuments({ userId: user._id });
      const executionsCount = await FlowExecution.countDocuments({ userId: user._id });
      const schedulesCount = await FlowSchedule.countDocuments({ userId: user._id });

      const stats = {
        totalFlows: flowsCount,
        totalExecutions: executionsCount,
        totalSchedules: schedulesCount,
        storageUsed: user.executionStorageUsed,
        storageQuota: user.executionStorageQuota,
        storageUsedPercentage: (user.executionStorageUsed / user.executionStorageQuota) * 100,
        accountCreated: user.createdAt,
        lastLogin: user.lastLoginAt,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled
      };

      return formatSuccess(stats, 'Estatísticas obtidas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Obter estatísticas do dashboard
  async getDashboardStats(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Executar todas as queries em paralelo
      const [totalFlows, sharedFlows, activeSchedules, totalExecutions] = await Promise.all([
        Flow.countDocuments({ userId: user._id }),
        Flow.countDocuments({
          userId: user._id,
          isPublic: true,
          'publicationData.status': 'approved'
        }),
        FlowSchedule.countDocuments({
          userId: user._id,
          enabled: true
        }),
        FlowExecution.countDocuments({ userId: user._id })
      ]);

      const stats = {
        // Workspace Overview
        accountCreated: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        teamMembers: 1, // Fixo por enquanto (futura feature de teams)
        plan: 'Free', // Fixo por enquanto (futura feature de plans)

        // Stats Cards
        totalFlows,
        sharedFlows,
        activeSchedules,
        totalExecutions
      };

      return formatSuccess(stats, 'Estatísticas do dashboard obtidas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Obter sessões ativas
  async getActiveSessions(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      const sessions = user.activeSessions.map(session => ({
        id: session._id,
        device: session.device,
        ip: session.ip,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity
      }));

      return formatSuccess(sessions, 'Sessões obtidas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Revogar sessão específica
  async revokeSession(userId, sessionId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      const sessionIndex = user.activeSessions.findIndex(
        s => s._id.toString() === sessionId
      );

      if (sessionIndex === -1) {
        return formatError('Sessão não encontrada', 'SESSION_NOT_FOUND');
      }

      user.activeSessions.splice(sessionIndex, 1);
      await user.save();

      return formatSuccess(null, 'Sessão revogada com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Revogar todas as sessões (exceto a atual)
  async revokeAllSessions(userId, currentToken) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Manter apenas a sessão atual
      user.activeSessions = user.activeSessions.filter(
        s => s.token === currentToken
      );

      await user.save();

      return formatSuccess(null, 'Todas as sessões foram revogadas');
    } catch (error) {
      throw error;
    }
  }

  // Obter contas conectadas
  async getConnectedAccounts(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      const accounts = {
        google: !!user.googleId,
        provider: user.provider
      };

      return formatSuccess(accounts, 'Contas conectadas obtidas com sucesso');
    } catch (error) {
      throw error;
    }
  }

  // Ativar 2FA
  async enable2FA(userId, password) {
    try {
      const user = await User.findById(userId).select('+password +twoFactorSecret');
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      // Verificar senha (se não for login social)
      if (user.provider === 'local') {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          return formatError('Senha incorreta', 'INVALID_PASSWORD');
        }
      }

      if (user.twoFactorEnabled) {
        return formatError('2FA já está ativado', '2FA_ALREADY_ENABLED');
      }

      // Gerar secret para 2FA
      const secret = speakeasy.generateSecret({
        name: `Flow-Forge (${user.email})`,
        length: 32
      });

      // Gerar QR Code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      // Salvar secret (ainda não ativado)
      user.twoFactorSecret = secret.base32;
      await user.save();

      return formatSuccess({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntry: secret.otpauth_url
      }, 'Escaneie o QR Code com seu aplicativo autenticador');
    } catch (error) {
      logger.error('Error enabling 2FA:', error);
      throw error;
    }
  }

  // Verificar e confirmar 2FA
  async verify2FA(userId, token) {
    try {
      const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      if (!user.twoFactorSecret) {
        return formatError('2FA não foi inicializado', '2FA_NOT_INITIALIZED');
      }

      // Verificar token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Aceita tokens de ±2 intervalos de tempo (60s)
      });

      if (!verified) {
        return formatError('Token inválido', 'INVALID_2FA_TOKEN');
      }

      // Ativar 2FA e gerar códigos de backup
      if (!user.twoFactorEnabled) {
        const backupCodes = tokenService.generateBackupCodes(10);
        const hashedBackupCodes = tokenService.hashBackupCodes(backupCodes);

        user.twoFactorEnabled = true;
        user.twoFactorBackupCodes = hashedBackupCodes;
        await user.save();

        return formatSuccess({
          backupCodes,
          message: 'Guarde estes códigos em um local seguro. Você pode usá-los para acessar sua conta se perder o acesso ao autenticador.'
        }, '2FA ativado com sucesso');
      }

      return formatSuccess(null, 'Token verificado com sucesso');
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      throw error;
    }
  }

  // Desativar 2FA
  async disable2FA(userId, password, token) {
    try {
      const user = await User.findById(userId).select('+password +twoFactorSecret +twoFactorBackupCodes');
      if (!user) {
        return formatError('Usuário não encontrado', 'USER_NOT_FOUND');
      }

      if (!user.twoFactorEnabled) {
        return formatError('2FA não está ativado', '2FA_NOT_ENABLED');
      }

      // Verificar senha
      if (user.provider === 'local') {
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
          return formatError('Senha incorreta', 'INVALID_PASSWORD');
        }
      }

      // Verificar token
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        return formatError('Token inválido', 'INVALID_2FA_TOKEN');
      }

      // Desativar 2FA
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorBackupCodes = undefined;
      await user.save();

      return formatSuccess(null, '2FA desativado com sucesso');
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: function() {
      // Senha é obrigatória apenas se não for login social
      return !this.googleId;
    },
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true, // Permite null para users sem Google
    index: true
  },
  picture: {
    type: String
  },
  provider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLoginAt: {
    type: Date
  },
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  refreshToken: {
    type: String,
    select: false
  },
  executionStorageUsed: {
    type: Number,  // bytes
    default: 0
  },
  executionStorageQuota: {
    type: Number,  // bytes
    default: 5 * 1024 * 1024  // 5MB
  },
  // Verificação de email
  verificationToken: {
    type: String,
    select: false
  },
  verificationTokenExpires: {
    type: Date,
    select: false
  },
  // Reset de senha
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  // Autenticação de dois fatores (2FA)
  twoFactorSecret: {
    type: String,
    select: false
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorBackupCodes: {
    type: [String],
    select: false
  },
  // Preferências do usuário
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['pt-BR', 'en-US'],
      default: 'pt-BR'
    },
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  // Segurança
  lastPasswordChange: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  // Tentativas de 2FA
  twoFactorAttempts: {
    type: Number,
    default: 0
  },
  twoFactorLockUntil: {
    type: Date
  },
  twoFactorTempToken: {
    type: String,
    select: false
  },
  // Sessões ativas
  activeSessions: [{
    token: {
      type: String,
      required: true
    },
    device: String,
    ip: String,
    userAgent: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    }
  }],
  // Role/Tipo de conta com hierarquia
  role: {
    type: String,
    enum: ['user', 'moderator', 'administrator'],
    default: 'user'
  },

  // Perfil público (para flows públicos)
  publicProfile: {
    displayName: String,
    bio: {
      type: String,
      maxlength: [500, 'Bio não pode ter mais de 500 caracteres']
    },
    avatar: String,
    website: {
      type: String,
      maxlength: [200, 'URL do website não pode ter mais de 200 caracteres']
    },

    isVerifiedCreator: {
      type: Boolean,
      default: false
    },

    publicStats: {
      totalPublicFlows: {
        type: Number,
        default: 0
      },
      totalDownloads: {
        type: Number,
        default: 0
      },
      averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
      },
      totalFollowers: {
        type: Number,
        default: 0
      }
    },

    publicationLimits: {
      maxPublicFlows: {
        type: Number,
        default: 10
      },
      cooldownHours: {
        type: Number,
        default: 24
      },
      lastPublishedAt: Date
    }
  },

  // Soft delete
  deletedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash da senha antes de salvar
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Método para limpar dados sensíveis
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshToken;
  delete userObject.verificationToken;
  delete userObject.verificationTokenExpires;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordExpires;
  delete userObject.twoFactorSecret;
  delete userObject.twoFactorBackupCodes;
  delete userObject.activeSessions;
  return userObject;
};

// Método para verificar se conta está bloqueada
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Método para incrementar tentativas de login
userSchema.methods.incrementLoginAttempts = async function() {
  // Se já passou o tempo de bloqueio, resetar
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return await this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Bloquear após 5 tentativas (30 minutos)
  if (this.loginAttempts + 1 >= 5) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 minutos
  }

  return await this.updateOne(updates);
};

// Método para resetar tentativas de login
userSchema.methods.resetLoginAttempts = async function() {
  return await this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

// Método para verificar se 2FA está bloqueado
userSchema.methods.is2FALocked = function() {
  return !!(this.twoFactorLockUntil && this.twoFactorLockUntil > Date.now());
};

// Método para incrementar tentativas de 2FA
userSchema.methods.increment2FAAttempts = async function() {
  // Se já passou o tempo de bloqueio, resetar
  if (this.twoFactorLockUntil && this.twoFactorLockUntil < Date.now()) {
    return await this.updateOne({
      $set: { twoFactorAttempts: 1 },
      $unset: { twoFactorLockUntil: 1 }
    });
  }

  const updates = { $inc: { twoFactorAttempts: 1 } };

  // Bloquear após 5 tentativas (15 minutos)
  if (this.twoFactorAttempts + 1 >= 5) {
    updates.$set = { twoFactorLockUntil: Date.now() + 15 * 60 * 1000 }; // 15 minutos
  }

  return await this.updateOne(updates);
};

// Método para resetar tentativas de 2FA
userSchema.methods.reset2FAAttempts = async function() {
  return await this.updateOne({
    $set: { twoFactorAttempts: 0 },
    $unset: { twoFactorLockUntil: 1, twoFactorTempToken: 1 }
  });
};

// ==================== MÉTODOS DE PERMISSÕES (ROLES) ====================

/**
 * Hierarquia de roles:
 * administrator (nível 3) > moderator (nível 2) > user (nível 1)
 */
const ROLE_HIERARCHY = {
  user: 1,
  moderator: 2,
  administrator: 3
};

// Verifica se o usuário tem um role específico
userSchema.methods.hasRole = function(role) {
  return this.role === role;
};

// Verifica se o usuário tem pelo menos o role especificado (ou superior)
userSchema.methods.hasMinimumRole = function(minimumRole) {
  const userLevel = ROLE_HIERARCHY[this.role] || 0;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userLevel >= requiredLevel;
};

// Verifica se o usuário é administrador
userSchema.methods.isAdministrator = function() {
  return this.role === 'administrator';
};

// Verifica se o usuário é moderador ou superior
userSchema.methods.isModerator = function() {
  return this.hasMinimumRole('moderator');
};

// Verifica se o usuário pode moderar conteúdo
userSchema.methods.canModerate = function() {
  return this.hasMinimumRole('moderator');
};

// Verifica se o usuário pode gerenciar outros usuários
userSchema.methods.canManageUsers = function() {
  return this.role === 'administrator';
};

// Verifica se o usuário pode gerenciar roles
userSchema.methods.canManageRoles = function() {
  return this.role === 'administrator';
};

// Verifica se o usuário pode promover outro usuário para um role
userSchema.methods.canPromoteToRole = function(targetRole) {
  if (!this.isAdministrator()) return false;

  const userLevel = ROLE_HIERARCHY[this.role] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;

  // Administrador pode promover para qualquer role abaixo dele
  return targetLevel < userLevel;
};

// Nota: índice de email já definido como unique: true acima

module.exports = mongoose.model('User', userSchema);
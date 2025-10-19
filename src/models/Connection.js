const mongoose = require('mongoose');
const crypto = require('crypto');

const connectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['google', 'google_analytics', 'google_sheets', 'facebook_ads', 'linkedin_ads', 'twitter_ads'],
    index: true
  },
  serviceType: {
    type: String,
    enum: ['analytics', 'sheets', 'drive', 'gmail', 'generic', null],
    index: true
  },
  purpose: {
    type: String,
    enum: ['connection', 'authentication'],
    default: 'connection',
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  // Tokens criptografados
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String
  },
  // Metadados da conexão
  expiresAt: {
    type: Date,
    required: true
  },
  scope: {
    type: [String],
    default: []
  },
  // Informações adicionais do provider
  providerData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsedAt: {
    type: Date
  },
  errorCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String
  }
}, {
  timestamps: true
});

// Índices compostos
connectionSchema.index({ userId: 1, provider: 1 });
connectionSchema.index({ userId: 1, provider: 1, serviceType: 1, isActive: 1 });
connectionSchema.index({ userId: 1, isActive: 1 });

// Encryption key (deve estar no .env)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : crypto.randomBytes(32);
const IV_LENGTH = 16;

// Métodos para criptografar/descriptografar
connectionSchema.methods.encryptToken = function(token) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

connectionSchema.methods.decryptToken = function(encryptedToken) {
  if (!encryptedToken) return null;

  try {
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('❌ Erro ao descriptografar token:', error.message);
    return null;
  }
};

// Getters para tokens descriptografados (não salvos no banco)
connectionSchema.virtual('decryptedAccessToken').get(function() {
  return this.decryptToken(this.accessToken);
});

connectionSchema.virtual('decryptedRefreshToken').get(function() {
  return this.decryptToken(this.refreshToken);
});

// Métodos de instância
connectionSchema.methods.isExpired = function() {
  return new Date() >= this.expiresAt;
};

connectionSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

connectionSchema.methods.markError = function(error) {
  this.errorCount += 1;
  this.lastError = error.message || error;

  // Desativar após 5 erros consecutivos
  if (this.errorCount >= 5) {
    this.isActive = false;
  }

  return this.save();
};

connectionSchema.methods.resetErrors = function() {
  this.errorCount = 0;
  this.lastError = null;
  this.isActive = true;
  return this.save();
};

// Métodos estáticos
connectionSchema.statics.findByUserAndProvider = function(userId, provider) {
  return this.find({ userId, provider, isActive: true })
    .sort({ lastUsedAt: -1 })
    .lean();
};

connectionSchema.statics.findByService = function(userId, provider, serviceType) {
  return this.findOne({ userId, provider, serviceType, isActive: true, purpose: 'connection' })
    .sort({ lastUsedAt: -1 });
};

connectionSchema.statics.findActiveConnection = function(connectionId, userId) {
  return this.findOne({ _id: connectionId, userId, isActive: true });
};

// Remover tokens do JSON por segurança
connectionSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.accessToken;
  delete obj.refreshToken;
  return obj;
};

const Connection = mongoose.model('Connection', connectionSchema);

module.exports = Connection;
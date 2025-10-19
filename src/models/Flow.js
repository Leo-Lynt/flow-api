const mongoose = require('mongoose');

const flowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nome do fluxo é obrigatório'],
    trim: true,
    maxlength: [100, 'Nome não pode ter mais de 100 caracteres']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição não pode ter mais de 500 caracteres']
  },
  category: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    trim: true,
    maxlength: [100, 'Categoria não pode ter mais de 100 caracteres']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },

  // Dados de publicação
  publicationData: {
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'rejected', 'quarantined'],
      default: 'draft'
    },
    publishedAt: Date,
    lastUpdatedAt: Date,

    moderationNotes: String,
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    moderatedAt: Date,

    rejectionReason: String,
    quarantineReason: String,

    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Metadados públicos
  publicMetadata: {
    detailedDescription: {
      type: String,
      maxlength: [5000, 'Descrição detalhada não pode ter mais de 5000 caracteres']
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    subcategory: String,

    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner'
    },
    estimatedTime: Number, // minutos

    screenshots: [{
      url: String,
      caption: String
    }],

    author: {
      name: String,
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    },

    // Licenciamento
    license: {
      type: String,
      enum: ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'All-Rights-Reserved'],
      default: 'MIT'
    },
    allowForking: {
      type: Boolean,
      default: true
    },
    requireAttribution: {
      type: Boolean,
      default: true
    },

    // Rastreamento de origem
    originalFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flow'
    },
    forkedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flow'
    },
    forkChain: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flow'
    }]
  },

  // Estatísticas públicas
  publicStats: {
    views: {
      type: Number,
      default: 0
    },
    imports: {
      type: Number,
      default: 0
    },
    forks: {
      type: Number,
      default: 0
    },

    // Ratings
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    totalRatings: {
      type: Number,
      default: 0
    },
    ratingDistribution: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    },

    // Reviews
    totalReviews: {
      type: Number,
      default: 0
    },

    // Reports
    totalReports: {
      type: Number,
      default: 0
    },
    reportCategories: {
      spam: { type: Number, default: 0 },
      malicious: { type: Number, default: 0 },
      broken: { type: Number, default: 0 },
      duplicate: { type: Number, default: 0 },
      inappropriate: { type: Number, default: 0 }
    }
  },

  // Análise de segurança
  securityScan: {
    lastScannedAt: Date,
    status: {
      type: String,
      enum: ['pending', 'clean', 'suspicious', 'dangerous'],
      default: 'pending'
    },
    warnings: [String],
    detectedPatterns: [String]
  },

  flowDataId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlowData'
  },
  totalNodes: {
    type: Number,
    default: 0
  },
  executionStats: {
    totalExecutions: {
      type: Number,
      default: 0
    },
    successfulExecutions: {
      type: Number,
      default: 0
    },
    failedExecutions: {
      type: Number,
      default: 0
    },
    lastExecutedAt: {
      type: Date
    },
    avgExecutionTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Índices
flowSchema.index({ userId: 1, createdAt: -1 });
flowSchema.index({ name: 'text', description: 'text' });
flowSchema.index({ isPublic: 1, createdAt: -1 });
flowSchema.index({ category: 1 });

// Índices para flows públicos
flowSchema.index({ 'publicationData.status': 1, 'publicStats.averageRating': -1 });
flowSchema.index({ 'publicationData.status': 1, 'publicStats.imports': -1 });
flowSchema.index({ 'publicationData.status': 1, 'publicationData.isVerified': 1 });
flowSchema.index({ 'publicMetadata.tags': 1 });
flowSchema.index({ 'publicMetadata.difficulty': 1 });

module.exports = mongoose.model('Flow', flowSchema);

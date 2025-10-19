const mongoose = require('mongoose');

const flowReportSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flow',
    required: true,
    index: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  category: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    enum: ['spam', 'malicious', 'broken', 'duplicate', 'inappropriate'],
    index: true
  },

  reason: {
    type: String,
    required: [true, 'Motivo é obrigatório'],
    trim: true,
    minlength: [10, 'Motivo deve ter no mínimo 10 caracteres'],
    maxlength: [500, 'Motivo não pode ter mais de 500 caracteres']
  },

  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
    index: true
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,

  action: {
    type: String,
    enum: ['quarantine', 'delete', 'warn_author', 'ban_author', 'no_action']
  },

  // Prevenção de spam de reports
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

// Índices
flowReportSchema.index({ flowId: 1, status: 1 });
flowReportSchema.index({ reportedBy: 1, createdAt: -1 });
flowReportSchema.index({ status: 1, createdAt: -1 });
flowReportSchema.index({ category: 1 });

// Prevenir múltiplos reports do mesmo usuário para o mesmo flow
flowReportSchema.index({ flowId: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model('FlowReport', flowReportSchema);

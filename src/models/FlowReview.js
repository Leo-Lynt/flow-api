const mongoose = require('mongoose');

const flowReviewSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flow',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  rating: {
    type: Number,
    required: [true, 'Rating é obrigatório'],
    min: [1, 'Rating mínimo é 1'],
    max: [5, 'Rating máximo é 5']
  },

  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Título não pode ter mais de 100 caracteres']
  },

  comment: {
    type: String,
    required: [true, 'Comentário é obrigatório'],
    trim: true,
    minlength: [20, 'Comentário deve ter no mínimo 20 caracteres'],
    maxlength: [1000, 'Comentário não pode ter mais de 1000 caracteres']
  },

  helpful: {
    type: Number,
    default: 0
  },

  helpfulBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  moderationStatus: {
    type: String,
    enum: ['active', 'hidden', 'removed'],
    default: 'active'
  },

  moderationReason: String,
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: Date
}, {
  timestamps: true
});

// Índices
flowReviewSchema.index({ flowId: 1, createdAt: -1 });
flowReviewSchema.index({ userId: 1, createdAt: -1 });
flowReviewSchema.index({ flowId: 1, userId: 1 }, { unique: true }); // Apenas 1 review por usuário por flow
flowReviewSchema.index({ rating: 1 });
flowReviewSchema.index({ helpful: -1 });
flowReviewSchema.index({ moderationStatus: 1 });

// Métodos
flowReviewSchema.methods.markAsHelpful = async function(userId) {
  if (!this.helpfulBy.includes(userId)) {
    this.helpfulBy.push(userId);
    this.helpful += 1;
    await this.save();
  }
};

flowReviewSchema.methods.unmarkAsHelpful = async function(userId) {
  const index = this.helpfulBy.indexOf(userId);
  if (index > -1) {
    this.helpfulBy.splice(index, 1);
    this.helpful -= 1;
    await this.save();
  }
};

module.exports = mongoose.model('FlowReview', flowReviewSchema);

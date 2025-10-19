const mongoose = require('mongoose');

const flowCacheEntrySchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Flow'
  },

  nodeId: {
    type: String,
    required: true
  },

  // Hash da configuração (detecta mudanças)
  hash: {
    type: String,
    required: true
  },

  // Hashes dos nodes upstream (dependency tracking)
  upstreamHashes: {
    type: Map,
    of: String,
    default: new Map()
  },

  // Resultado comprimido (economiza espaço)
  resultCompressed: {
    type: Buffer,
    required: true
  },

  // Metadata
  size: {
    type: Number,
    required: true
  },

  timestamp: {
    type: Date,
    default: Date.now
  },

  // TTL automático - MongoDB remove após 24h
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: true
  }
}, {
  timestamps: true
});

// Índice composto para busca rápida
flowCacheEntrySchema.index({ flowId: 1, nodeId: 1 }, { unique: true });

// Índice TTL - MongoDB remove automaticamente
flowCacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('FlowCacheEntry', flowCacheEntrySchema);

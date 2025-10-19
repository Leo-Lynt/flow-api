const mongoose = require('mongoose');

// Sub-schema para nodes
const nodeSnapshotSchema = new mongoose.Schema({
  nodeId: String,
  type: String,
  name: String
}, { _id: false });

// Sub-schema para logs
const logEntrySchema = new mongoose.Schema({
  nodeId: String,
  nodeName: String,
  status: {
    type: String,
    enum: ['success', 'failed', 'skipped']
  },
  executionTime: Number,
  error: String,
  stackTrace: String,
  timestamp: Date
}, { _id: false });

const flowExecutionSchema = new mongoose.Schema({
  flowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flow',
    default: null,
    index: true
  },
  flowName: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Status e timing
  status: {
    type: String,
    enum: ['success', 'failed', 'running'],
    required: true,
    index: true
  },
  startedAt: {
    type: Date,
    required: true,
    index: true
  },
  completedAt: {
    type: Date
  },
  executionTime: {
    type: Number // ms
  },

  // Snapshot do flow
  flowSnapshot: {
    totalNodes: { type: Number, required: true },
    nodes: [nodeSnapshotSchema]
  },

  // Resultados
  nodesExecuted: {
    type: Number,
    default: 0
  },

  // Cache stats
  cacheStats: {
    hits: { type: Number, default: 0 },
    misses: { type: Number, default: 0 }
  },

  // Logs
  logs: [logEntrySchema],

  // Input/Output (opcional)
  inputData: {
    type: mongoose.Schema.Types.Mixed
  },
  outputData: {
    type: mongoose.Schema.Types.Mixed
  },

  // Flags
  flowDeleted: {
    type: Boolean,
    default: false
  },
  deletedFlowName: {
    type: String
  },

  // Metadata
  triggeredBy: {
    type: String,
    enum: ['manual', 'api', 'schedule'],
    default: 'manual'
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlowSchedule',
    default: null
  }
}, {
  timestamps: true
});

// Indexes compostos para queries comuns
flowExecutionSchema.index({ userId: 1, startedAt: -1 });
flowExecutionSchema.index({ flowId: 1, startedAt: -1 });
flowExecutionSchema.index({ userId: 1, flowId: 1, startedAt: -1 });
flowExecutionSchema.index({ scheduleId: 1, startedAt: -1 });

module.exports = mongoose.model('FlowExecution', flowExecutionSchema);

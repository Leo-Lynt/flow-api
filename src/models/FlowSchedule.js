const mongoose = require('mongoose');

const flowScheduleSchema = new mongoose.Schema({
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

  // Configuração do schedule
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  scheduleType: {
    type: String,
    enum: ['interval', 'daily', 'weekly', 'monthly', 'cron'],
    required: true
  },

  // Intervalo (para type = 'interval')
  intervalValue: {
    type: Number,
    min: 1
  },
  intervalUnit: {
    type: String,
    enum: ['minutes', 'hours', 'days']
  },

  // Horário específico (para daily/weekly/monthly)
  time: {
    type: String,
    match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:MM format
  },
  timezone: {
    type: String,
    default: 'UTC'
  },

  // Dias da semana (para weekly) - 0=domingo, 1=segunda, ..., 6=sábado
  daysOfWeek: {
    type: [Number],
    validate: {
      validator: function(arr) {
        return arr.every(day => day >= 0 && day <= 6);
      },
      message: 'Days of week must be between 0 (Sunday) and 6 (Saturday)'
    }
  },

  // Dia do mês (para monthly)
  dayOfMonth: {
    type: Number,
    min: 1,
    max: 31
  },

  // Cron expression (para type = 'cron')
  cronExpression: {
    type: String
  },

  // Input data para execução
  inputData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // Execução
  lastExecutedAt: {
    type: Date
  },
  nextExecutionAt: {
    type: Date,
    index: true
  },
  executionCount: {
    type: Number,
    default: 0
  },

  // Limites
  maxExecutions: {
    type: Number,
    default: null // null = ilimitado
  },
  expiresAt: {
    type: Date,
    default: null
  },

  // Status
  lastExecutionStatus: {
    type: String,
    enum: ['success', 'failed', 'pending'],
    default: 'pending'
  },
  consecutiveFailures: {
    type: Number,
    default: 0
  },
  pausedReason: {
    type: String
  },

  // Prevenção de concorrência
  isCurrentlyRunning: {
    type: Boolean,
    default: false
  },
  currentExecutionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FlowExecution'
  }
}, {
  timestamps: true
});

// Indexes compostos
flowScheduleSchema.index({ flowId: 1, enabled: 1 });
flowScheduleSchema.index({ userId: 1, enabled: 1 });
flowScheduleSchema.index({ enabled: 1, nextExecutionAt: 1 }); // Critical para buscar schedules prontos

// Validação personalizada
flowScheduleSchema.pre('save', function(next) {
  // Validar campos obrigatórios por tipo
  if (this.scheduleType === 'interval') {
    if (!this.intervalValue || !this.intervalUnit) {
      return next(new Error('Interval schedules require intervalValue and intervalUnit'));
    }
    // Intervalo mínimo: 5 minutos
    if (this.intervalUnit === 'minutes' && this.intervalValue < 5) {
      return next(new Error('Minimum interval is 5 minutes'));
    }
  }

  if (['daily', 'weekly', 'monthly'].includes(this.scheduleType)) {
    if (!this.time) {
      return next(new Error(`${this.scheduleType} schedules require time`));
    }
  }

  if (this.scheduleType === 'weekly') {
    if (!this.daysOfWeek || this.daysOfWeek.length === 0) {
      return next(new Error('Weekly schedules require at least one day of week'));
    }
  }

  if (this.scheduleType === 'monthly') {
    if (!this.dayOfMonth) {
      return next(new Error('Monthly schedules require dayOfMonth'));
    }
  }

  if (this.scheduleType === 'cron') {
    if (!this.cronExpression) {
      return next(new Error('Cron schedules require cronExpression'));
    }
  }

  next();
});

module.exports = mongoose.model('FlowSchedule', flowScheduleSchema);

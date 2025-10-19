const cron = require('node-cron');
const FlowSchedule = require('../models/FlowSchedule');
const Flow = require('../models/Flow');
const flowExecutor = require('./flowExecutor');
const { calculateNextExecution } = require('./scheduleCalculator');
const { resolveDynamicInputs } = require('../utils/dynamicInputResolver');

class SchedulerService {
  constructor() {
    this.jobs = new Map(); // Map<scheduleId, cronTask>
    this.initialized = false;
  }

  /**
   * Inicializar scheduler: carregar todos schedules ativos
   */
  async initialize() {
    if (this.initialized) {
      console.log('⚠️  Scheduler already initialized');
      return;
    }

    try {
      const schedules = await FlowSchedule.find({
        enabled: true,
        $or: [
          { expiresAt: { $gt: new Date() } },
          { expiresAt: null }
        ]
      }).populate('flowId');

      for (const schedule of schedules) {
        if (schedule.flowId) {
          await this.registerSchedule(schedule);
        }
      }

      this.initialized = true;
      console.log(`✅ Scheduler initialized with ${schedules.length} active schedules`);
    } catch (error) {
      console.error('❌ Failed to initialize scheduler:', error);
      throw error;
    }
  }

  /**
   * Registrar schedule no node-cron
   */
  async registerSchedule(schedule) {
    const scheduleId = schedule._id.toString();

    // Se já existe, remover
    if (this.jobs.has(scheduleId)) {
      this.unregisterSchedule(scheduleId);
    }

    try {
      // Converter para cron expression
      const cronExpression = this.toCronExpression(schedule);

      // Calcular próxima execução se não existir
      if (!schedule.nextExecutionAt) {
        schedule.nextExecutionAt = calculateNextExecution(schedule);
        await schedule.save();
      }

      // Criar job
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledFlow(scheduleId);
      }, {
        timezone: schedule.timezone || 'UTC',
        scheduled: true
      });

      this.jobs.set(scheduleId, task);
      console.log(`📅 Registered schedule ${scheduleId} with cron: ${cronExpression}`);
    } catch (error) {
      console.error(`❌ Failed to register schedule ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Desregistrar schedule
   */
  unregisterSchedule(scheduleId) {
    const task = this.jobs.get(scheduleId.toString());
    if (task) {
      task.stop();
      this.jobs.delete(scheduleId.toString());
      console.log(`🗑️  Unregistered schedule ${scheduleId}`);
    }
  }

  /**
   * Executar flow agendado
   */
  async executeScheduledFlow(scheduleId) {
    let schedule;

    try {
      schedule = await FlowSchedule.findById(scheduleId).populate({
        path: 'flowId',
        populate: {
          path: 'flowDataId'
        }
      });

      if (!schedule || !schedule.enabled) {
        console.log(`⚠️  Schedule ${scheduleId} not found or disabled`);
        return;
      }

      // Prevenção de concorrência
      if (schedule.isCurrentlyRunning) {
        console.log(`⏭️  Skipping schedule ${scheduleId} - already running`);
        return;
      }

      // Marcar como rodando
      schedule.isCurrentlyRunning = true;
      await schedule.save();

      const flow = schedule.flowId;
      if (!flow) {
        throw new Error('Flow not found');
      }

      // Mapear flowDataId para flowData para compatibilidade
      if (!flow.flowData && flow.flowDataId) {
        flow.flowData = flow.flowDataId.data || flow.flowDataId;
      }

      console.log(`🚀 Executing scheduled flow: ${flow.name} (${scheduleId})`);

      // Resolver inputs dinâmicos ({{today}}, {{today - 10 days}}, etc.)
      const resolvedInputData = resolveDynamicInputs(
        schedule.inputData || {},
        flow,
        {
          lastExecution: schedule.lastExecutedAt,
          timezone: schedule.timezone || 'UTC'
        }
      );

      console.log(`📝 Original inputs:`, schedule.inputData);
      console.log(`✨ Resolved inputs:`, resolvedInputData);

      // Executar flow com triggeredBy='schedule'
      const result = await flowExecutor.executeFlow(
        flow,
        resolvedInputData,
        schedule.userId,
        'schedule',
        scheduleId
      );

      // Atualizar sucesso
      schedule.lastExecutedAt = new Date();
      schedule.executionCount++;
      schedule.lastExecutionStatus = 'success';
      schedule.consecutiveFailures = 0;
      schedule.nextExecutionAt = calculateNextExecution(schedule);
      schedule.isCurrentlyRunning = false;
      schedule.currentExecutionId = null;

      // Verificar limite de execuções
      if (schedule.maxExecutions && schedule.executionCount >= schedule.maxExecutions) {
        schedule.enabled = false;
        schedule.pausedReason = 'Max executions reached';
        this.unregisterSchedule(scheduleId);
        console.log(`⏸️  Schedule ${scheduleId} paused - max executions reached`);
      }

      await schedule.save();
      console.log(`✅ Schedule ${scheduleId} executed successfully`);

    } catch (error) {
      console.error(`❌ Schedule ${scheduleId} failed:`, error);

      if (schedule) {
        // Atualizar falha
        schedule.lastExecutedAt = new Date();
        schedule.lastExecutionStatus = 'failed';
        schedule.consecutiveFailures = (schedule.consecutiveFailures || 0) + 1;
        schedule.isCurrentlyRunning = false;
        schedule.currentExecutionId = null;

        // Pausar se muitas falhas consecutivas
        if (schedule.consecutiveFailures >= 3) {
          schedule.enabled = false;
          schedule.pausedReason = `Paused after ${schedule.consecutiveFailures} consecutive failures: ${error.message}`;
          this.unregisterSchedule(scheduleId);
          console.log(`⏸️  Schedule ${scheduleId} paused - too many failures`);
        } else {
          // Calcular próxima execução mesmo após falha
          schedule.nextExecutionAt = calculateNextExecution(schedule);
        }

        await schedule.save();
      }
    }
  }

  /**
   * Converter schedule para cron expression
   */
  toCronExpression(schedule) {
    const { scheduleType } = schedule;

    if (scheduleType === 'cron') {
      return schedule.cronExpression;
    }

    if (scheduleType === 'interval') {
      const { intervalValue, intervalUnit } = schedule;

      if (intervalUnit === 'minutes') {
        return `*/${intervalValue} * * * *`;
      }
      if (intervalUnit === 'hours') {
        return `0 */${intervalValue} * * *`;
      }
      if (intervalUnit === 'days') {
        return `0 0 */${intervalValue} * *`;
      }

      throw new Error(`Unknown interval unit: ${intervalUnit}`);
    }

    if (scheduleType === 'daily') {
      const [hour, minute] = schedule.time.split(':');
      return `${minute} ${hour} * * *`;
    }

    if (scheduleType === 'weekly') {
      const [hour, minute] = schedule.time.split(':');
      const days = schedule.daysOfWeek.join(',');
      return `${minute} ${hour} * * ${days}`;
    }

    if (scheduleType === 'monthly') {
      const [hour, minute] = schedule.time.split(':');
      return `${minute} ${hour} ${schedule.dayOfMonth} * *`;
    }

    throw new Error(`Unknown schedule type: ${scheduleType}`);
  }

  /**
   * Recarregar schedule específico
   */
  async reloadSchedule(scheduleId) {
    const schedule = await FlowSchedule.findById(scheduleId).populate('flowId');

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    if (schedule.enabled) {
      await this.registerSchedule(schedule);
    } else {
      this.unregisterSchedule(scheduleId);
    }
  }

  /**
   * Obter estatísticas do scheduler
   */
  getStats() {
    return {
      totalSchedules: this.jobs.size,
      activeSchedules: Array.from(this.jobs.keys())
    };
  }
}

// Singleton
const schedulerService = new SchedulerService();

module.exports = schedulerService;

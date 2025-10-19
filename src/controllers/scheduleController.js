const FlowSchedule = require('../models/FlowSchedule');
const Flow = require('../models/Flow');
const FlowExecution = require('../models/FlowExecution');
const schedulerService = require('../services/schedulerService');
const { calculateNextExecution } = require('../services/scheduleCalculator');
const mongoose = require('mongoose');

/**
 * Criar novo schedule
 * POST /api/schedules
 */
async function createSchedule(req, res) {
  try {
    const userId = req.user.userId;
    const {
      flowId,
      scheduleType,
      intervalValue,
      intervalUnit,
      time,
      timezone,
      daysOfWeek,
      dayOfMonth,
      cronExpression,
      inputData,
      maxExecutions,
      expiresAt
    } = req.body;

    // Verificar se flow existe e pertence ao usuário
    const flow = await Flow.findOne({ _id: flowId, userId });
    if (!flow) {
      return res.status(404).json({
        success: false,
        error: { message: 'Flow not found', code: 'FLOW_NOT_FOUND' }
      });
    }

    // Verificar limite de schedules por usuário (máximo 10)
    const existingSchedules = await FlowSchedule.countDocuments({ userId, enabled: true });
    if (existingSchedules >= 10) {
      return res.status(400).json({
        success: false,
        error: { message: 'Maximum of 10 active schedules reached', code: 'SCHEDULE_LIMIT_EXCEEDED' }
      });
    }

    // Criar schedule
    const schedule = await FlowSchedule.create({
      flowId,
      userId,
      scheduleType,
      intervalValue,
      intervalUnit,
      time,
      timezone: timezone || 'UTC',
      daysOfWeek,
      dayOfMonth,
      cronExpression,
      inputData: inputData || {},
      maxExecutions,
      expiresAt,
      enabled: true,
      nextExecutionAt: null // Será calculado
    });

    // Calcular próxima execução
    schedule.nextExecutionAt = calculateNextExecution(schedule);
    await schedule.save();

    // Registrar no scheduler
    await schedulerService.registerSchedule(schedule);

    res.status(201).json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'CREATE_SCHEDULE_ERROR'
      }
    });
  }
}

/**
 * Listar schedules do usuário
 * GET /api/schedules
 */
async function listSchedules(req, res) {
  try {
    const userId = req.user.userId;
    const { flowId, enabled, page = 1, limit = 20 } = req.query;

    const query = { userId: new mongoose.Types.ObjectId(userId) };

    if (flowId) {
      query.flowId = new mongoose.Types.ObjectId(flowId);
    }

    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }

    const schedules = await FlowSchedule.find(query)
      .populate('flowId', 'name description')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const total = await FlowSchedule.countDocuments(query);

    res.json({
      success: true,
      data: schedules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error listing schedules:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'LIST_SCHEDULES_ERROR'
      }
    });
  }
}

/**
 * Obter detalhes de um schedule
 * GET /api/schedules/:id
 */
async function getSchedule(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const schedule = await FlowSchedule.findOne({
      _id: id,
      userId
    }).populate('flowId', 'name description');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' }
      });
    }

    // Buscar últimas 10 execuções deste schedule
    const recentExecutions = await FlowExecution.find({
      scheduleId: id
    })
      .sort({ startedAt: -1 })
      .limit(10)
      .select('status startedAt completedAt executionTime')
      .lean();

    res.json({
      success: true,
      data: {
        ...schedule.toObject(),
        recentExecutions
      }
    });

  } catch (error) {
    console.error('Error getting schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'GET_SCHEDULE_ERROR'
      }
    });
  }
}

/**
 * Atualizar schedule
 * PUT /api/schedules/:id
 */
async function updateSchedule(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const updates = req.body;

    const schedule = await FlowSchedule.findOne({ _id: id, userId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' }
      });
    }

    // Atualizar campos permitidos
    const allowedUpdates = [
      'intervalValue', 'intervalUnit', 'time', 'timezone',
      'daysOfWeek', 'dayOfMonth', 'cronExpression', 'inputData',
      'maxExecutions', 'expiresAt'
    ];

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        schedule[field] = updates[field];
      }
    });

    // Recalcular próxima execução
    schedule.nextExecutionAt = calculateNextExecution(schedule);

    await schedule.save();

    // Recarregar no scheduler
    if (schedule.enabled) {
      await schedulerService.reloadSchedule(id);
    }

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'UPDATE_SCHEDULE_ERROR'
      }
    });
  }
}

/**
 * Deletar schedule
 * DELETE /api/schedules/:id
 */
async function deleteSchedule(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const schedule = await FlowSchedule.findOneAndDelete({ _id: id, userId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' }
      });
    }

    // Desregistrar do scheduler
    schedulerService.unregisterSchedule(id);

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'DELETE_SCHEDULE_ERROR'
      }
    });
  }
}

/**
 * Ativar schedule
 * POST /api/schedules/:id/enable
 */
async function enableSchedule(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const schedule = await FlowSchedule.findOne({ _id: id, userId }).populate('flowId');

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' }
      });
    }

    schedule.enabled = true;
    schedule.pausedReason = null;
    schedule.consecutiveFailures = 0;
    schedule.nextExecutionAt = calculateNextExecution(schedule);
    await schedule.save();

    // Registrar no scheduler
    await schedulerService.registerSchedule(schedule);

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error enabling schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'ENABLE_SCHEDULE_ERROR'
      }
    });
  }
}

/**
 * Desativar schedule
 * POST /api/schedules/:id/disable
 */
async function disableSchedule(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const schedule = await FlowSchedule.findOne({ _id: id, userId });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schedule not found', code: 'SCHEDULE_NOT_FOUND' }
      });
    }

    schedule.enabled = false;
    schedule.pausedReason = 'Manually disabled by user';
    await schedule.save();

    // Desregistrar do scheduler
    schedulerService.unregisterSchedule(id);

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error('Error disabling schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'DISABLE_SCHEDULE_ERROR'
      }
    });
  }
}

module.exports = {
  createSchedule,
  listSchedules,
  getSchedule,
  updateSchedule,
  deleteSchedule,
  enableSchedule,
  disableSchedule
};

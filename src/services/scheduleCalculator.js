/**
 * Calcula a próxima data de execução baseado no tipo de schedule
 */

/**
 * Calcular próxima execução
 * @param {Object} schedule - FlowSchedule document
 * @param {Date} fromDate - Data base para cálculo (default: agora)
 * @returns {Date} Próxima data de execução
 */
function calculateNextExecution(schedule, fromDate = new Date()) {
  const { scheduleType } = schedule;

  switch (scheduleType) {
    case 'interval':
      return calculateIntervalNext(schedule, fromDate);

    case 'daily':
      return calculateDailyNext(schedule, fromDate);

    case 'weekly':
      return calculateWeeklyNext(schedule, fromDate);

    case 'monthly':
      return calculateMonthlyNext(schedule, fromDate);

    case 'cron':
      // Para cron, retornar próxima hora válida (simplificado)
      // Em produção, usar lib como 'cron-parser'
      return new Date(fromDate.getTime() + 60 * 60 * 1000); // +1 hora

    default:
      throw new Error(`Unknown schedule type: ${scheduleType}`);
  }
}

/**
 * Calcular próxima execução para intervalo
 */
function calculateIntervalNext(schedule, fromDate) {
  const { intervalValue, intervalUnit } = schedule;

  let milliseconds = 0;

  switch (intervalUnit) {
    case 'minutes':
      milliseconds = intervalValue * 60 * 1000;
      break;
    case 'hours':
      milliseconds = intervalValue * 60 * 60 * 1000;
      break;
    case 'days':
      milliseconds = intervalValue * 24 * 60 * 60 * 1000;
      break;
    default:
      throw new Error(`Unknown interval unit: ${intervalUnit}`);
  }

  return new Date(fromDate.getTime() + milliseconds);
}

/**
 * Calcular próxima execução diária
 */
function calculateDailyNext(schedule, fromDate) {
  const { time, timezone = 'UTC' } = schedule;
  const [hours, minutes] = time.split(':').map(Number);

  const next = new Date(fromDate);
  next.setHours(hours, minutes, 0, 0);

  // Se já passou da hora hoje, agendar para amanhã
  if (next <= fromDate) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Calcular próxima execução semanal
 */
function calculateWeeklyNext(schedule, fromDate) {
  const { time, daysOfWeek, timezone = 'UTC' } = schedule;
  const [hours, minutes] = time.split(':').map(Number);

  const currentDay = fromDate.getDay(); // 0-6 (domingo-sábado)
  const sortedDays = daysOfWeek.sort((a, b) => a - b);

  // Encontrar próximo dia da semana
  let nextDay = sortedDays.find(day => {
    if (day > currentDay) return true;
    if (day === currentDay) {
      // Verificar se ainda não passou da hora hoje
      const testDate = new Date(fromDate);
      testDate.setHours(hours, minutes, 0, 0);
      return testDate > fromDate;
    }
    return false;
  });

  // Se não encontrou, pegar primeiro dia da próxima semana
  if (!nextDay) {
    nextDay = sortedDays[0];
  }

  const next = new Date(fromDate);
  const daysToAdd = (nextDay - currentDay + 7) % 7 || 7;

  next.setDate(next.getDate() + daysToAdd);
  next.setHours(hours, minutes, 0, 0);

  // Se já passou da hora no mesmo dia, adicionar 7 dias
  if (next <= fromDate) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

/**
 * Calcular próxima execução mensal
 */
function calculateMonthlyNext(schedule, fromDate) {
  const { time, dayOfMonth, timezone = 'UTC' } = schedule;
  const [hours, minutes] = time.split(':').map(Number);

  const next = new Date(fromDate);
  next.setDate(dayOfMonth);
  next.setHours(hours, minutes, 0, 0);

  // Se já passou da data/hora neste mês, agendar para próximo mês
  if (next <= fromDate) {
    next.setMonth(next.getMonth() + 1);
    next.setDate(dayOfMonth); // Reajustar dia (caso mês tenha menos dias)
  }

  return next;
}

/**
 * Verificar se schedule deve ser executado agora
 * Tolerância de 1 minuto
 */
function shouldExecuteNow(schedule, currentDate = new Date()) {
  if (!schedule.nextExecutionAt) return false;

  const diff = currentDate.getTime() - schedule.nextExecutionAt.getTime();
  const oneMinute = 60 * 1000;

  // Se nextExecutionAt está até 1 minuto no passado ou no futuro próximo
  return diff >= 0 && diff < oneMinute;
}

module.exports = {
  calculateNextExecution,
  shouldExecuteNow
};

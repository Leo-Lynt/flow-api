const moment = require('moment-timezone');

/**
 * Resolve expressões dinâmicas nos inputs do schedule
 * Suporta: {{today}}, {{today - 10 days}}, {{lastMonth}}, etc.
 *
 * @param {Object} inputData - Inputs do schedule (podem conter expressões)
 * @param {Object} flow - Flow object com flowData
 * @param {Object} context - Contexto da execução (lastExecution, timezone)
 * @returns {Object} InputData com expressões resolvidas e formatadas
 */
function resolveDynamicInputs(inputData, flow, context = {}) {
  if (!inputData || typeof inputData !== 'object') {
    return inputData;
  }

  const { lastExecution, timezone = 'UTC' } = context;
  const resolvedData = {};

  // Buscar definições de parâmetros do flow
  const parameterDefinitions = getParameterDefinitions(flow);

  // Resolver cada input
  for (const [key, value] of Object.entries(inputData)) {
    if (typeof value === 'string' && value.includes('{{')) {
      // É uma expressão dinâmica
      const paramDef = parameterDefinitions[key];
      const dateFormat = paramDef?.dateFormat || 'YYYY-MM-DD';

      resolvedData[key] = resolveExpression(value, {
        lastExecution,
        timezone,
        dateFormat
      });
    } else {
      // Valor estático
      resolvedData[key] = value;
    }
  }

  return resolvedData;
}

/**
 * Buscar definições de parâmetros dos input nodes
 */
function getParameterDefinitions(flow) {
  const definitions = {};

  if (!flow.flowData || !flow.flowData.nodes || !flow.flowData.nodeData) {
    return definitions;
  }

  const { nodes, nodeData } = flow.flowData;
  const inputNodes = nodes.filter(n => n.type === 'input');

  inputNodes.forEach(node => {
    const data = nodeData[node.id] || {};
    const parameters = data.parameters || [];

    parameters.forEach(param => {
      definitions[param.name] = {
        type: param.type,
        dateFormat: param.dateFormat,
        defaultValue: param.defaultValue
      };
    });
  });

  return definitions;
}

/**
 * Resolver uma expressão dinâmica
 * Ex: "{{today - 10 days}}" → "2025-10-07"
 */
function resolveExpression(expression, context) {
  const { lastExecution, timezone, dateFormat } = context;

  // Extrair conteúdo entre {{}}
  const match = expression.match(/\{\{(.+?)\}\}/);
  if (!match) {
    return expression; // Não é expressão válida
  }

  const expr = match[1].trim();

  // Criar momento base no timezone correto
  let date = moment.tz(timezone);

  // Parsear expressão
  if (expr === 'today') {
    // Já está em "today"
  } else if (expr === 'yesterday') {
    date.subtract(1, 'days');
  } else if (expr === 'tomorrow') {
    date.add(1, 'days');
  } else if (expr === 'now') {
    return date.valueOf(); // Timestamp
  } else if (expr === 'startOfMonth') {
    date.startOf('month');
  } else if (expr === 'endOfMonth') {
    date.endOf('month');
  } else if (expr === 'startOfYear') {
    date.startOf('year');
  } else if (expr === 'endOfYear') {
    date.endOf('year');
  } else if (expr === 'lastMonth') {
    date.subtract(1, 'months').startOf('month');
  } else if (expr === 'lastExecution') {
    if (lastExecution) {
      date = moment.tz(lastExecution, timezone);
    }
  } else if (expr.includes(' - ') || expr.includes(' + ')) {
    // Expressão relativa: "today - 10 days", "today + 5 weeks"
    date = resolveRelativeExpression(expr, timezone);
  } else {
    // Expressão não reconhecida, retornar original
    return expression;
  }

  // Formatar com o formato definido no input
  return date.format(dateFormat);
}

/**
 * Resolver expressões relativas
 * Ex: "today - 10 days", "today + 2 weeks", "startOfMonth - 1 month"
 */
function resolveRelativeExpression(expr, timezone) {
  // Parse: "base +/- N unit"
  const regex = /^(\w+)\s*([+\-])\s*(\d+)\s+(\w+)$/;
  const match = expr.match(regex);

  if (!match) {
    return moment.tz(timezone); // Fallback para hoje
  }

  const [, base, operator, amount, unit] = match;

  // Resolver base
  let date = moment.tz(timezone);

  if (base === 'yesterday') {
    date.subtract(1, 'days');
  } else if (base === 'tomorrow') {
    date.add(1, 'days');
  } else if (base === 'startOfMonth') {
    date.startOf('month');
  } else if (base === 'endOfMonth') {
    date.endOf('month');
  } else if (base === 'startOfYear') {
    date.startOf('year');
  } else if (base === 'endOfYear') {
    date.endOf('year');
  }
  // Se for "today" ou não reconhecido, já está correto

  // Aplicar offset
  const parsedAmount = parseInt(amount, 10);
  if (operator === '-') {
    date.subtract(parsedAmount, unit);
  } else {
    date.add(parsedAmount, unit);
  }

  return date;
}

module.exports = {
  resolveDynamicInputs
};

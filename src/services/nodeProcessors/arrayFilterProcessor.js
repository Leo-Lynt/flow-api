class ArrayFilterProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { conditions = [], logicalOperator = 'AND' } = data;

      if (!inputData) {
        throw new Error('Dados de entrada não fornecidos');
      }

      if (!Array.isArray(inputData)) {
        throw new Error('Dados de entrada devem ser um array');
      }

      if (!conditions || conditions.length === 0) {
        // Sem condições, retornar todos os itens
        return {
          success: true,
          data: inputData,
          metadata: {
            inputCount: inputData.length,
            outputCount: inputData.length,
            conditionsCount: 0,
            logicalOperator
          }
        };
      }

      // Filtrar array baseado nas condições
      const filtered = inputData.filter(item => {
        const results = conditions.map(condition =>
          this.evaluateCondition(item, condition)
        );

        // Aplicar operador lógico
        if (logicalOperator === 'OR') {
          return results.some(r => r);
        } else {
          // AND por padrão
          return results.every(r => r);
        }
      });

      return {
        success: true,
        data: filtered,
        metadata: {
          inputCount: inputData.length,
          outputCount: filtered.length,
          conditionsCount: conditions.length,
          logicalOperator,
          filtered: inputData.length - filtered.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Avaliar uma condição individual
  evaluateCondition(item, condition) {
    const { field, operator, value } = condition;

    if (!field || !operator) {
      return false;
    }

    const itemValue = this.getFieldValue(item, field);
    return this.applyOperator(itemValue, operator, value);
  }

  // Obter valor de um campo (suporta notação de ponto)
  getFieldValue(obj, field) {
    if (!field || typeof field !== 'string') {
      return obj;
    }

    const pathParts = field.split('.');
    let current = obj;

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Suporte para arrays
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        current = current[arrayName];
        if (Array.isArray(current)) {
          current = current[parseInt(index)];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  // Aplicar operador de comparação
  applyOperator(value, operator, expectedValue) {
    switch (operator) {
      case 'equals':
      case '==':
        return value == expectedValue;
      case 'strict_equals':
      case '===':
        return value === expectedValue;
      case 'not_equals':
      case '!=':
        return value != expectedValue;
      case 'greater_than':
      case '>':
        return value > expectedValue;
      case 'greater_than_equals':
      case '>=':
        return value >= expectedValue;
      case 'less_than':
      case '<':
        return value < expectedValue;
      case 'less_than_equals':
      case '<=':
        return value <= expectedValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(expectedValue).toLowerCase());
      case 'ends_with':
        return String(value).toLowerCase().endsWith(String(expectedValue).toLowerCase());
      case 'in':
        return Array.isArray(expectedValue) && expectedValue.includes(value);
      case 'not_in':
        return Array.isArray(expectedValue) && !expectedValue.includes(value);
      case 'exists':
        return value !== undefined && value !== null;
      case 'not_exists':
        return value === undefined || value === null;
      case 'is_empty':
        return value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
      case 'is_not_empty':
        return value !== '' && value !== null && value !== undefined && (!Array.isArray(value) || value.length > 0);
      default:
        throw new Error(`Operador não suportado: ${operator}`);
    }
  }

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    if (!data.conditions || !Array.isArray(data.conditions)) {
      errors.push('Conditions deve ser um array');
    } else {
      data.conditions.forEach((condition, index) => {
        if (!condition.field) {
          errors.push(`Condição ${index}: field é obrigatório`);
        }
        if (!condition.operator) {
          errors.push(`Condição ${index}: operator é obrigatório`);
        }
      });
    }

    const validOperators = ['AND', 'OR'];
    if (data.logicalOperator && !validOperators.includes(data.logicalOperator)) {
      errors.push(`logicalOperator inválido. Valores válidos: ${validOperators.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ArrayFilterProcessor();

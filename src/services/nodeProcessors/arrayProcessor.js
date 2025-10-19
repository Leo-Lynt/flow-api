class ArrayProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { operation, field, filterCondition, sortField, sortOrder = 'asc', limit } = data;

      if (!inputData) {
        throw new Error('Dados de entrada não fornecidos');
      }

      if (!Array.isArray(inputData)) {
        throw new Error('Dados de entrada devem ser um array');
      }

      if (!operation) {
        throw new Error('Operação não especificada');
      }

      let result;

      switch (operation) {
        case 'sum':
          result = this.sum(inputData, field);
          break;
        case 'average':
          result = this.average(inputData, field);
          break;
        case 'count':
          result = this.count(inputData, filterCondition);
          break;
        case 'filter':
          result = this.filter(inputData, filterCondition);
          break;
        case 'first':
          result = this.first(inputData, parseInt(limit) || 1);
          break;
        case 'last':
          result = this.last(inputData, parseInt(limit) || 1);
          break;
        case 'sort':
          result = this.sort(inputData, sortField, sortOrder);
          break;
        case 'unique':
          result = this.unique(inputData, field);
          break;
        case 'group':
          result = this.group(inputData, field);
          break;
        case 'min':
          result = this.min(inputData, field);
          break;
        case 'max':
          result = this.max(inputData, field);
          break;
        case 'flatten':
          result = this.flatten(inputData);
          break;
        default:
          throw new Error(`Operação não suportada: ${operation}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          operation,
          inputCount: inputData.length,
          outputCount: Array.isArray(result) ? result.length : 1,
          field: field || null
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

  // Somar valores de um campo
  sum(array, field) {
    if (!field) {
      throw new Error('Campo é obrigatório para operação sum');
    }

    let total = 0;
    let count = 0;

    for (const item of array) {
      const value = this.getFieldValue(item, field);
      if (typeof value === 'number' && !isNaN(value)) {
        total += value;
        count++;
      }
    }

    return {
      sum: total,
      count,
      field
    };
  }

  // Calcular média de um campo
  average(array, field) {
    if (!field) {
      throw new Error('Campo é obrigatório para operação average');
    }

    const sumResult = this.sum(array, field);
    const average = sumResult.count > 0 ? sumResult.sum / sumResult.count : 0;

    return {
      average,
      sum: sumResult.sum,
      count: sumResult.count,
      field
    };
  }

  // Contar itens (com filtro opcional)
  count(array, filterCondition) {
    if (!filterCondition) {
      return { count: array.length };
    }

    const filtered = this.filter(array, filterCondition);
    return {
      count: filtered.length,
      totalCount: array.length,
      filterCondition
    };
  }

  // Filtrar array
  filter(array, condition) {
    if (!condition) {
      return array;
    }

    const { field, operator, value } = condition;

    if (!field || !operator) {
      throw new Error('Condição de filtro deve conter field e operator');
    }

    return array.filter(item => {
      const itemValue = this.getFieldValue(item, field);
      return this.evaluateCondition(itemValue, operator, value);
    });
  }

  // Obter primeiros itens
  first(array, count = 1) {
    const result = array.slice(0, count);
    return count === 1 ? result[0] : result;
  }

  // Obter últimos itens
  last(array, count = 1) {
    const result = array.slice(-count);
    return count === 1 ? result[0] : result;
  }

  // Ordenar array
  sort(array, field, order = 'asc') {
    if (!field) {
      throw new Error('Campo é obrigatório para ordenação');
    }

    const sorted = [...array].sort((a, b) => {
      const valueA = this.getFieldValue(a, field);
      const valueB = this.getFieldValue(b, field);

      let comparison = 0;

      if (valueA < valueB) comparison = -1;
      if (valueA > valueB) comparison = 1;

      return order === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  // Obter valores únicos
  unique(array, field) {
    if (!field) {
      // Se não especificar campo, unique nos itens do array
      return [...new Set(array)];
    }

    const values = array.map(item => this.getFieldValue(item, field));
    return [...new Set(values)].filter(v => v !== undefined);
  }

  // Agrupar por campo
  group(array, field) {
    if (!field) {
      throw new Error('Campo é obrigatório para agrupamento');
    }

    const groups = {};

    for (const item of array) {
      const key = this.getFieldValue(item, field);
      const keyString = String(key);

      if (!groups[keyString]) {
        groups[keyString] = [];
      }
      groups[keyString].push(item);
    }

    // Converter para array de objetos
    return Object.entries(groups).map(([key, items]) => ({
      key,
      count: items.length,
      items
    }));
  }

  // Valor mínimo
  min(array, field) {
    if (!field) {
      throw new Error('Campo é obrigatório para operação min');
    }

    let minValue = Infinity;
    let minItem = null;

    for (const item of array) {
      const value = this.getFieldValue(item, field);
      if (typeof value === 'number' && !isNaN(value) && value < minValue) {
        minValue = value;
        minItem = item;
      }
    }

    return {
      min: minValue === Infinity ? null : minValue,
      item: minItem,
      field
    };
  }

  // Valor máximo
  max(array, field) {
    if (!field) {
      throw new Error('Campo é obrigatório para operação max');
    }

    let maxValue = -Infinity;
    let maxItem = null;

    for (const item of array) {
      const value = this.getFieldValue(item, field);
      if (typeof value === 'number' && !isNaN(value) && value > maxValue) {
        maxValue = value;
        maxItem = item;
      }
    }

    return {
      max: maxValue === -Infinity ? null : maxValue,
      item: maxItem,
      field
    };
  }

  // Achatar array aninhado
  flatten(array, depth = 1) {
    const flattenRecursive = (arr, currentDepth) => {
      return currentDepth > 0 ? arr.reduce((acc, val) => {
        if (Array.isArray(val)) {
          return acc.concat(flattenRecursive(val, currentDepth - 1));
        } else {
          return acc.concat(val);
        }
      }, []) : arr.slice();
    };

    return flattenRecursive(array, depth);
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

  // Avaliar condição de filtro
  evaluateCondition(value, operator, expectedValue) {
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
      default:
        throw new Error(`Operador não suportado: ${operator}`);
    }
  }

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    if (!data.operation) {
      errors.push('Operação é obrigatória');
    }

    const validOperations = ['sum', 'average', 'count', 'filter', 'first', 'last', 'sort', 'unique', 'group', 'min', 'max', 'flatten'];
    if (data.operation && !validOperations.includes(data.operation)) {
      errors.push(`Operação inválida. Operações válidas: ${validOperations.join(', ')}`);
    }

    // Validações específicas por operação
    const fieldRequiredOps = ['sum', 'average', 'sort', 'unique', 'group', 'min', 'max'];
    if (fieldRequiredOps.includes(data.operation) && !data.field) {
      errors.push(`Campo é obrigatório para a operação ${data.operation}`);
    }

    if (data.operation === 'filter' && !data.filterCondition) {
      errors.push('Condição de filtro é obrigatória para a operação filter');
    }

    if (data.filterCondition) {
      const { field, operator } = data.filterCondition;
      if (!field || !operator) {
        errors.push('Condição de filtro deve conter field e operator');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new ArrayProcessor();
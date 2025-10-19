class OutputProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { outputFormat = 'raw', label, includeMetadata = false, transformations = [] } = data;

      let result = inputData;

      // Aplicar transformações se especificadas
      if (transformations && transformations.length > 0) {
        result = this.applyTransformations(result, transformations);
      }

      // Formatar saída conforme especificado
      const formattedOutput = this.formatOutput(result, outputFormat, label, includeMetadata, context);

      return {
        success: true,
        data: formattedOutput,
        metadata: {
          outputFormat,
          label,
          includeMetadata,
          transformationsApplied: transformations.length,
          finalOutputType: typeof formattedOutput
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

  // Formatar saída conforme o formato especificado
  formatOutput(data, format, label, includeMetadata, context) {
    const timestamp = new Date().toISOString();

    switch (format) {
      case 'raw':
        return data;

      case 'wrapped':
        const wrapped = {
          result: data,
          timestamp
        };

        if (label) {
          wrapped.label = label;
        }

        if (includeMetadata) {
          wrapped.metadata = this.extractMetadata(data, context);
        }

        return wrapped;

      case 'array':
        if (Array.isArray(data)) {
          return data;
        } else {
          return [data];
        }

      case 'summary':
        return this.createSummary(data, label, timestamp);

      case 'csv':
        return this.convertToCSV(data);

      case 'json':
        return JSON.stringify(data, null, 2);

      case 'table':
        return this.createTable(data);

      case 'stats':
        return this.createStatistics(data, label, timestamp);

      default:
        throw new Error(`Formato de saída não suportado: ${format}`);
    }
  }

  // Aplicar transformações aos dados
  applyTransformations(data, transformations) {
    let result = data;

    for (const transformation of transformations) {
      const { type, config } = transformation;

      switch (type) {
        case 'filter':
          result = this.filterData(result, config);
          break;
        case 'map':
          result = this.mapData(result, config);
          break;
        case 'sort':
          result = this.sortData(result, config);
          break;
        case 'limit':
          result = this.limitData(result, config);
          break;
        case 'rename':
          result = this.renameFields(result, config);
          break;
        default:
          console.warn(`Transformação não suportada: ${type}`);
      }
    }

    return result;
  }

  // Criar resumo dos dados
  createSummary(data, label, timestamp) {
    const summary = {
      timestamp,
      type: Array.isArray(data) ? 'array' : typeof data
    };

    if (label) {
      summary.label = label;
    }

    if (Array.isArray(data)) {
      summary.count = data.length;
      summary.sample = data.slice(0, 3); // Primeiros 3 itens como amostra

      // Se array de objetos, extrair campos comuns
      if (data.length > 0 && typeof data[0] === 'object') {
        summary.fields = Object.keys(data[0]);
      }

      // Se array de números, calcular estatísticas
      if (data.length > 0 && typeof data[0] === 'number') {
        summary.statistics = this.calculateArrayStats(data);
      }
    } else if (typeof data === 'object' && data !== null) {
      summary.fields = Object.keys(data);
      summary.fieldCount = Object.keys(data).length;
    } else {
      summary.value = data;
    }

    return summary;
  }

  // Converter para CSV
  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Se array de objetos
    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = Object.keys(data[0]);
      const rows = data.map(item =>
        headers.map(header => {
          const value = item[header];
          // Escapar valores que contêm vírgula ou aspas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }

    // Se array de valores primitivos
    return data.join('\n');
  }

  // Criar tabela formatada
  createTable(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'Dados devem ser um array não vazio para formato de tabela' };
    }

    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = Object.keys(data[0]);
      const rows = data.map(item =>
        headers.reduce((row, header) => {
          row[header] = item[header];
          return row;
        }, {})
      );

      return {
        headers,
        rows,
        count: data.length
      };
    }

    // Array de valores primitivos
    return {
      headers: ['value'],
      rows: data.map((value, index) => ({ index, value })),
      count: data.length
    };
  }

  // Criar estatísticas
  createStatistics(data, label, timestamp) {
    const stats = {
      timestamp,
      type: Array.isArray(data) ? 'array' : typeof data
    };

    if (label) {
      stats.label = label;
    }

    if (Array.isArray(data)) {
      stats.array = this.calculateArrayStats(data);
    } else if (typeof data === 'object' && data !== null) {
      stats.object = {
        fieldCount: Object.keys(data).length,
        fields: Object.keys(data),
        types: Object.keys(data).reduce((types, key) => {
          types[key] = typeof data[key];
          return types;
        }, {})
      };
    } else {
      stats.value = {
        data,
        type: typeof data,
        length: typeof data === 'string' ? data.length : undefined
      };
    }

    return stats;
  }

  // Calcular estatísticas de array
  calculateArrayStats(arr) {
    const stats = {
      count: arr.length,
      types: {}
    };

    // Contar tipos
    arr.forEach(item => {
      const type = typeof item;
      stats.types[type] = (stats.types[type] || 0) + 1;
    });

    // Se array de números, calcular estatísticas numéricas
    const numbers = arr.filter(item => typeof item === 'number' && !isNaN(item));
    if (numbers.length > 0) {
      stats.numeric = {
        count: numbers.length,
        sum: numbers.reduce((sum, num) => sum + num, 0),
        average: numbers.reduce((sum, num) => sum + num, 0) / numbers.length,
        min: Math.min(...numbers),
        max: Math.max(...numbers)
      };
    }

    return stats;
  }

  // Extrair metadados do contexto
  extractMetadata(data, context) {
    return {
      executionContext: {
        hasGlobalVariables: Object.keys(context.globalVariables || {}).length > 0,
        globalVariableCount: Object.keys(context.globalVariables || {}).length,
        hasInputData: context.inputData !== undefined
      },
      dataAnalysis: {
        type: Array.isArray(data) ? 'array' : typeof data,
        size: typeof data === 'string' ? data.length :
              Array.isArray(data) ? data.length :
              typeof data === 'object' && data !== null ? Object.keys(data).length : 1
      }
    };
  }

  // Transformações de dados
  filterData(data, config) {
    if (!Array.isArray(data)) {
      return data;
    }

    const { field, operator, value } = config;
    return data.filter(item => {
      const itemValue = this.getFieldValue(item, field);
      return this.evaluateCondition(itemValue, operator, value);
    });
  }

  mapData(data, config) {
    if (!Array.isArray(data)) {
      return data;
    }

    const { mapping } = config;
    return data.map(item => {
      const mapped = {};
      for (const [newField, oldField] of Object.entries(mapping)) {
        mapped[newField] = this.getFieldValue(item, oldField);
      }
      return mapped;
    });
  }

  sortData(data, config) {
    if (!Array.isArray(data)) {
      return data;
    }

    const { field, order = 'asc' } = config;
    return [...data].sort((a, b) => {
      const valueA = this.getFieldValue(a, field);
      const valueB = this.getFieldValue(b, field);

      let comparison = 0;
      if (valueA < valueB) comparison = -1;
      if (valueA > valueB) comparison = 1;

      return order === 'desc' ? -comparison : comparison;
    });
  }

  limitData(data, config) {
    if (!Array.isArray(data)) {
      return data;
    }

    const { count, offset = 0 } = config;
    return data.slice(offset, offset + count);
  }

  renameFields(data, config) {
    const { mapping } = config;

    if (Array.isArray(data)) {
      return data.map(item => this.renameObjectFields(item, mapping));
    } else if (typeof data === 'object' && data !== null) {
      return this.renameObjectFields(data, mapping);
    }

    return data;
  }

  renameObjectFields(obj, mapping) {
    const renamed = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = mapping[key] || key;
      renamed[newKey] = value;
    }
    return renamed;
  }

  // Utilitários
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
      current = current[part];
    }

    return current;
  }

  evaluateCondition(value, operator, expectedValue) {
    switch (operator) {
      case 'equals':
        return value == expectedValue;
      case 'not_equals':
        return value != expectedValue;
      case 'greater_than':
        return value > expectedValue;
      case 'less_than':
        return value < expectedValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(expectedValue).toLowerCase());
      default:
        return true;
    }
  }

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    const validFormats = ['raw', 'wrapped', 'array', 'summary', 'csv', 'json', 'table', 'stats'];
    if (data.outputFormat && !validFormats.includes(data.outputFormat)) {
      errors.push(`Formato de saída inválido. Formatos válidos: ${validFormats.join(', ')}`);
    }

    if (data.transformations && !Array.isArray(data.transformations)) {
      errors.push('Transformações devem ser um array');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new OutputProcessor();
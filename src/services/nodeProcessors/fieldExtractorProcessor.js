class FieldExtractorProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { fields, extractionMode = 'object', renameFields = {} } = data;

      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        throw new Error('Campos para extração não especificados');
      }

      if (!inputData) {
        throw new Error('Dados de entrada não fornecidos');
      }

      let result;

      // Determinar modo de extração baseado no tipo de dados de entrada
      if (Array.isArray(inputData)) {
        result = this.extractFromArray(inputData, fields, extractionMode, renameFields);
      } else if (typeof inputData === 'object' && inputData !== null) {
        result = this.extractFromObject(inputData, fields, extractionMode, renameFields);
      } else {
        throw new Error('Dados de entrada devem ser um objeto ou array');
      }

      return {
        success: true,
        data: result,
        metadata: {
          extractedFields: fields,
          inputType: Array.isArray(inputData) ? 'array' : 'object',
          outputType: Array.isArray(result) ? 'array' : 'object',
          recordCount: Array.isArray(result) ? result.length : 1,
          extractionMode
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

  // Extrair campos de um objeto
  extractFromObject(obj, fields, extractionMode, renameFields) {
    const extracted = {};

    for (const field of fields) {
      const value = this.getNestedValue(obj, field);
      const fieldName = renameFields[field] || field;

      if (value !== undefined) {
        extracted[fieldName] = value;
      }
    }

    // Se modo for array e só tem um campo, retorna array do valor
    if (extractionMode === 'array' && fields.length === 1) {
      const singleField = Object.values(extracted)[0];
      return Array.isArray(singleField) ? singleField : [singleField];
    }

    return extracted;
  }

  // Extrair campos de um array de objetos
  extractFromArray(arr, fields, extractionMode, renameFields) {
    const extracted = [];

    for (const item of arr) {
      if (typeof item === 'object' && item !== null) {
        const extractedItem = this.extractFromObject(item, fields, 'object', renameFields);

        // Se só tem um campo e modo é 'values', extrair só o valor
        if (extractionMode === 'values' && fields.length === 1) {
          const value = Object.values(extractedItem)[0];
          if (value !== undefined) {
            extracted.push(value);
          }
        } else {
          extracted.push(extractedItem);
        }
      }
    }

    return extracted;
  }

  // Obter valor aninhado usando notação de ponto
  getNestedValue(obj, path) {
    if (!path || typeof path !== 'string') {
      return undefined;
    }

    // Suporta arrays usando notação [index]
    const pathParts = path.split('.');
    let current = obj;

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Verificar se é acesso a array
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

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    if (!data.fields || !Array.isArray(data.fields)) {
      errors.push('Campo "fields" deve ser um array');
    } else if (data.fields.length === 0) {
      errors.push('Pelo menos um campo deve ser especificado');
    }

    if (data.extractionMode && !['object', 'array', 'values'].includes(data.extractionMode)) {
      errors.push('Modo de extração deve ser "object", "array" ou "values"');
    }

    if (data.renameFields && typeof data.renameFields !== 'object') {
      errors.push('renameFields deve ser um objeto');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Analisar dados de entrada e sugerir campos disponíveis
  analyzeInputData(inputData) {
    const analysis = {
      type: Array.isArray(inputData) ? 'array' : typeof inputData,
      availableFields: [],
      sampleData: null
    };

    if (Array.isArray(inputData) && inputData.length > 0) {
      analysis.sampleData = inputData[0];
      analysis.availableFields = this.extractAvailableFields(inputData[0]);
    } else if (typeof inputData === 'object' && inputData !== null) {
      analysis.sampleData = inputData;
      analysis.availableFields = this.extractAvailableFields(inputData);
    }

    return analysis;
  }

  // Extrair campos disponíveis de um objeto (incluindo aninhados)
  extractAvailableFields(obj, prefix = '', maxDepth = 3) {
    const fields = [];

    if (maxDepth <= 0 || typeof obj !== 'object' || obj === null) {
      return fields;
    }

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;

      // Adicionar o campo atual
      fields.push({
        path: fieldPath,
        type: Array.isArray(value) ? 'array' : typeof value,
        isNested: prefix !== ''
      });

      // Se for objeto, recursivamente extrair campos aninhados
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        fields.push(...this.extractAvailableFields(value, fieldPath, maxDepth - 1));
      }

      // Se for array de objetos, analisar o primeiro item
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        fields.push(...this.extractAvailableFields(value[0], `${fieldPath}[0]`, maxDepth - 1));
      }
    }

    return fields;
  }
}

module.exports = new FieldExtractorProcessor();
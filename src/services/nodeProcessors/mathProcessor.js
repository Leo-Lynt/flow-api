class MathProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { operation, operand, field } = data;

      if (!operation) {
        throw new Error('Operação matemática não especificada');
      }

      // Obter valores para a operação
      const { valueA, valueB } = this.extractValues(inputData, operand, field, node.type);

      let result;

      switch (operation || node.type) {
        case 'add':
          result = this.add(valueA, valueB);
          break;
        case 'subtract':
          result = this.subtract(valueA, valueB);
          break;
        case 'multiply':
          result = this.multiply(valueA, valueB);
          break;
        case 'divide':
          result = this.divide(valueA, valueB);
          break;
        case 'power':
          result = this.power(valueA, valueB);
          break;
        case 'modulo':
          result = this.modulo(valueA, valueB);
          break;
        case 'abs':
          result = this.absolute(valueA);
          break;
        case 'round':
          result = this.round(valueA, valueB);
          break;
        case 'ceil':
          result = this.ceil(valueA);
          break;
        case 'floor':
          result = this.floor(valueA);
          break;
        case 'sqrt':
          result = this.sqrt(valueA);
          break;
        case 'log':
          result = this.log(valueA, valueB);
          break;
        case 'min':
          result = this.min(valueA, valueB);
          break;
        case 'max':
          result = this.max(valueA, valueB);
          break;
        default:
          throw new Error(`Operação matemática não suportada: ${operation || node.type}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          operation: operation || node.type,
          inputValueA: valueA,
          inputValueB: valueB,
          outputType: typeof result
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

  // Extrair valores para operação
  extractValues(inputData, operand, field, nodeType) {
    let valueA, valueB;

    // Se inputData é um número
    if (typeof inputData === 'number') {
      valueA = inputData;
    }
    // Se inputData é um objeto e especificou field
    else if (typeof inputData === 'object' && inputData !== null && field) {
      valueA = this.getFieldValue(inputData, field);
    }
    // Se inputData é um array
    else if (Array.isArray(inputData)) {
      if (field) {
        // Extrair campo de cada item do array
        const values = inputData.map(item => this.getFieldValue(item, field)).filter(v => typeof v === 'number');
        valueA = values.length > 0 ? values : inputData;
      } else {
        valueA = inputData;
      }
    }
    // Tentar converter para número
    else {
      valueA = parseFloat(inputData);
    }

    // Obter segundo valor (operand)
    if (operand !== undefined) {
      if (typeof operand === 'number') {
        valueB = operand;
      } else if (typeof operand === 'string' && !isNaN(parseFloat(operand))) {
        valueB = parseFloat(operand);
      } else {
        valueB = operand;
      }
    }

    // Validar valores para operações que precisam de dois operandos
    const twoOperandOps = ['add', 'subtract', 'multiply', 'divide', 'power', 'modulo', 'min', 'max'];
    if (twoOperandOps.includes(nodeType) && (valueA === undefined || valueB === undefined)) {
      throw new Error('Dois valores numéricos são necessários para esta operação');
    }

    return { valueA, valueB };
  }

  // Operações matemáticas básicas
  add(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.add(val, b));
    }
    return this.ensureNumber(a) + this.ensureNumber(b);
  }

  subtract(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.subtract(val, b));
    }
    return this.ensureNumber(a) - this.ensureNumber(b);
  }

  multiply(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.multiply(val, b));
    }
    return this.ensureNumber(a) * this.ensureNumber(b);
  }

  divide(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.divide(val, b));
    }

    const numB = this.ensureNumber(b);
    if (numB === 0) {
      throw new Error('Divisão por zero não é permitida');
    }
    return this.ensureNumber(a) / numB;
  }

  power(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.power(val, b));
    }
    return Math.pow(this.ensureNumber(a), this.ensureNumber(b));
  }

  modulo(a, b) {
    if (Array.isArray(a)) {
      return a.map(val => this.modulo(val, b));
    }

    const numB = this.ensureNumber(b);
    if (numB === 0) {
      throw new Error('Módulo por zero não é permitido');
    }
    return this.ensureNumber(a) % numB;
  }

  // Operações matemáticas avançadas
  absolute(a) {
    if (Array.isArray(a)) {
      return a.map(val => this.absolute(val));
    }
    return Math.abs(this.ensureNumber(a));
  }

  round(a, precision = 0) {
    if (Array.isArray(a)) {
      return a.map(val => this.round(val, precision));
    }

    const num = this.ensureNumber(a);
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }

  ceil(a) {
    if (Array.isArray(a)) {
      return a.map(val => this.ceil(val));
    }
    return Math.ceil(this.ensureNumber(a));
  }

  floor(a) {
    if (Array.isArray(a)) {
      return a.map(val => this.floor(val));
    }
    return Math.floor(this.ensureNumber(a));
  }

  sqrt(a) {
    if (Array.isArray(a)) {
      return a.map(val => this.sqrt(val));
    }

    const num = this.ensureNumber(a);
    if (num < 0) {
      throw new Error('Raiz quadrada de número negativo não é permitida');
    }
    return Math.sqrt(num);
  }

  log(a, base = Math.E) {
    if (Array.isArray(a)) {
      return a.map(val => this.log(val, base));
    }

    const num = this.ensureNumber(a);
    if (num <= 0) {
      throw new Error('Logaritmo de número não positivo não é permitido');
    }

    if (base === Math.E) {
      return Math.log(num);
    } else {
      return Math.log(num) / Math.log(base);
    }
  }

  min(a, b) {
    if (Array.isArray(a)) {
      if (b !== undefined) {
        return a.map(val => this.min(val, b));
      } else {
        return Math.min(...a.filter(v => typeof v === 'number'));
      }
    }
    return Math.min(this.ensureNumber(a), this.ensureNumber(b));
  }

  max(a, b) {
    if (Array.isArray(a)) {
      if (b !== undefined) {
        return a.map(val => this.max(val, b));
      } else {
        return Math.max(...a.filter(v => typeof v === 'number'));
      }
    }
    return Math.max(this.ensureNumber(a), this.ensureNumber(b));
  }

  // Utilitários
  ensureNumber(value) {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }

    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Valor '${value}' não é um número válido`);
    }

    return parsed;
  }

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

  // Validar configuração do nó
  validateConfig(data, nodeType) {
    const errors = [];

    const validOperations = ['add', 'subtract', 'multiply', 'divide', 'power', 'modulo', 'abs', 'round', 'ceil', 'floor', 'sqrt', 'log', 'min', 'max'];
    const operation = data.operation || nodeType;

    if (!validOperations.includes(operation)) {
      errors.push(`Operação inválida. Operações válidas: ${validOperations.join(', ')}`);
    }

    // Operações que precisam de operando
    const operandRequiredOps = ['add', 'subtract', 'multiply', 'divide', 'power', 'modulo', 'round', 'log', 'min', 'max'];
    if (operandRequiredOps.includes(operation) && data.operand === undefined) {
      errors.push(`Operando é obrigatório para a operação ${operation}`);
    }

    if (data.operand !== undefined && typeof data.operand !== 'number' && isNaN(parseFloat(data.operand))) {
      errors.push('Operando deve ser um número válido');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new MathProcessor();
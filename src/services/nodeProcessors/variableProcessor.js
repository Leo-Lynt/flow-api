class VariableProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { operation, variableName, defaultValue, path } = data;

      if (!operation) {
        throw new Error('Operação não especificada');
      }

      if (!variableName) {
        throw new Error('Nome da variável é obrigatório');
      }

      // Garantir que globalVariables existe no contexto
      if (!context.globalVariables) {
        context.globalVariables = {};
      }

      let result;

      switch (operation) {
        case 'set':
          result = this.setVariable(context.globalVariables, variableName, inputData, path);
          break;
        case 'get':
          result = this.getVariable(context.globalVariables, variableName, defaultValue, path);
          break;
        case 'append':
          result = this.appendToVariable(context.globalVariables, variableName, inputData);
          break;
        case 'increment':
          result = this.incrementVariable(context.globalVariables, variableName, inputData || 1);
          break;
        case 'decrement':
          result = this.decrementVariable(context.globalVariables, variableName, inputData || 1);
          break;
        case 'delete':
          result = this.deleteVariable(context.globalVariables, variableName);
          break;
        case 'exists':
          result = this.variableExists(context.globalVariables, variableName);
          break;
        case 'list':
          result = this.listVariables(context.globalVariables);
          break;
        default:
          throw new Error(`Operação não suportada: ${operation}`);
      }

      return {
        success: true,
        data: result,
        metadata: {
          operation,
          variableName,
          variableType: typeof result,
          timestamp: new Date().toISOString()
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

  // Definir variável
  setVariable(globalVariables, variableName, value, path = null) {
    if (path) {
      // Se especificou um caminho, definir valor aninhado
      this.setNestedValue(globalVariables, variableName, path, value);
    } else {
      // Definir valor diretamente
      globalVariables[variableName] = value;
    }

    return {
      variableName,
      value: path ? this.getNestedValue(globalVariables[variableName], path) : globalVariables[variableName],
      path: path || null,
      operation: 'set'
    };
  }

  // Obter variável
  getVariable(globalVariables, variableName, defaultValue = null, path = null) {
    let value;

    if (!(variableName in globalVariables)) {
      value = defaultValue;
    } else if (path) {
      // Obter valor aninhado
      value = this.getNestedValue(globalVariables[variableName], path);
      if (value === undefined) {
        value = defaultValue;
      }
    } else {
      value = globalVariables[variableName];
    }

    return {
      variableName,
      value,
      path: path || null,
      operation: 'get',
      exists: variableName in globalVariables
    };
  }

  // Adicionar valor a array/string
  appendToVariable(globalVariables, variableName, value) {
    if (!(variableName in globalVariables)) {
      // Se variável não existe, criar como array
      globalVariables[variableName] = [value];
    } else if (Array.isArray(globalVariables[variableName])) {
      // Se é array, adicionar item
      globalVariables[variableName].push(value);
    } else if (typeof globalVariables[variableName] === 'string') {
      // Se é string, concatenar
      globalVariables[variableName] += String(value);
    } else {
      throw new Error(`Não é possível fazer append em variável do tipo ${typeof globalVariables[variableName]}`);
    }

    return {
      variableName,
      value: globalVariables[variableName],
      operation: 'append',
      newLength: Array.isArray(globalVariables[variableName]) ? globalVariables[variableName].length : globalVariables[variableName].length
    };
  }

  // Incrementar variável numérica
  incrementVariable(globalVariables, variableName, amount = 1) {
    if (!(variableName in globalVariables)) {
      globalVariables[variableName] = amount;
    } else if (typeof globalVariables[variableName] === 'number') {
      globalVariables[variableName] += amount;
    } else {
      throw new Error(`Não é possível incrementar variável do tipo ${typeof globalVariables[variableName]}`);
    }

    return {
      variableName,
      value: globalVariables[variableName],
      operation: 'increment',
      incrementAmount: amount
    };
  }

  // Decrementar variável numérica
  decrementVariable(globalVariables, variableName, amount = 1) {
    if (!(variableName in globalVariables)) {
      globalVariables[variableName] = -amount;
    } else if (typeof globalVariables[variableName] === 'number') {
      globalVariables[variableName] -= amount;
    } else {
      throw new Error(`Não é possível decrementar variável do tipo ${typeof globalVariables[variableName]}`);
    }

    return {
      variableName,
      value: globalVariables[variableName],
      operation: 'decrement',
      decrementAmount: amount
    };
  }

  // Deletar variável
  deleteVariable(globalVariables, variableName) {
    const existed = variableName in globalVariables;
    delete globalVariables[variableName];

    return {
      variableName,
      operation: 'delete',
      existed
    };
  }

  // Verificar se variável existe
  variableExists(globalVariables, variableName) {
    const exists = variableName in globalVariables;

    return {
      variableName,
      exists,
      operation: 'exists'
    };
  }

  // Listar todas as variáveis
  listVariables(globalVariables) {
    const variables = Object.keys(globalVariables).map(name => ({
      name,
      type: typeof globalVariables[name],
      value: globalVariables[name]
    }));

    return {
      variables,
      count: variables.length,
      operation: 'list'
    };
  }

  // Obter valor aninhado usando notação de ponto
  getNestedValue(obj, path) {
    if (!path || typeof path !== 'string') {
      return obj;
    }

    const pathParts = path.split('.');
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

  // Definir valor aninhado usando notação de ponto
  setNestedValue(obj, variableName, path, value) {
    // Garantir que a variável base existe
    if (!(variableName in obj)) {
      obj[variableName] = {};
    }

    const pathParts = path.split('.');
    let current = obj[variableName];

    // Navegar até o penúltimo nível
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];

      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;

        if (!(arrayName in current)) {
          current[arrayName] = [];
        }

        const arrayIndex = parseInt(index);
        if (!Array.isArray(current[arrayName])) {
          current[arrayName] = [];
        }

        // Expandir array se necessário
        while (current[arrayName].length <= arrayIndex) {
          current[arrayName].push({});
        }

        current = current[arrayName][arrayIndex];
      } else {
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    // Definir o valor final
    const lastPart = pathParts[pathParts.length - 1];
    const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);

    if (arrayMatch) {
      const [, arrayName, index] = arrayMatch;

      if (!(arrayName in current)) {
        current[arrayName] = [];
      }

      const arrayIndex = parseInt(index);
      if (!Array.isArray(current[arrayName])) {
        current[arrayName] = [];
      }

      // Expandir array se necessário
      while (current[arrayName].length <= arrayIndex) {
        current[arrayName].push(null);
      }

      current[arrayName][arrayIndex] = value;
    } else {
      current[lastPart] = value;
    }
  }

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    if (!data.operation) {
      errors.push('Operação é obrigatória');
    }

    const validOperations = ['set', 'get', 'append', 'increment', 'decrement', 'delete', 'exists', 'list'];
    if (data.operation && !validOperations.includes(data.operation)) {
      errors.push(`Operação inválida. Operações válidas: ${validOperations.join(', ')}`);
    }

    if (!data.variableName && data.operation !== 'list') {
      errors.push('Nome da variável é obrigatório');
    }

    if (data.variableName && typeof data.variableName !== 'string') {
      errors.push('Nome da variável deve ser uma string');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new VariableProcessor();
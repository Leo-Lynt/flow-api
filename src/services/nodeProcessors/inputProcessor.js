class InputProcessor {
  async process(node, context = {}, inputData = null) {
    try {
      const { data } = node;
      const { parameters = [] } = data;

      // Se temos inputData do contexto de execução, usar ele
      if (inputData && typeof inputData === 'object') {
        return {
          success: true,
          data: inputData,
          metadata: {
            source: 'execution_input',
            parameterCount: parameters.length,
            providedKeys: Object.keys(inputData)
          }
        };
      }

      // Se não temos inputData, usar os valores padrão dos parâmetros
      const defaultInputData = {};
      parameters.forEach(param => {
        if (param.defaultValue !== undefined) {
          defaultInputData[param.name] = param.defaultValue;
        }
      });

      return {
        success: true,
        data: defaultInputData,
        metadata: {
          source: 'default_values',
          parameterCount: parameters.length,
          providedKeys: Object.keys(defaultInputData)
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

  // Validar configuração do nó
  validateConfig(data) {
    const errors = [];

    if (!data.parameters || !Array.isArray(data.parameters)) {
      errors.push('Parâmetros devem ser um array');
    } else {
      // Validar cada parâmetro
      data.parameters.forEach((param, index) => {
        if (!param.name) {
          errors.push(`Parâmetro ${index} deve ter um nome`);
        }
        if (!param.type) {
          errors.push(`Parâmetro ${param.name || index} deve ter um tipo`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new InputProcessor();

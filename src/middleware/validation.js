const Joi = require('joi');
const { formatError } = require('../utils/helpers');

// Função para validar dados
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR', errors));
    }

    next();
  };
};

// Validar parâmetros da URL
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR', errors));
    }

    next();
  };
};

// Validar query parameters
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json(formatError(errors.join(', '), 'VALIDATION_ERROR', errors));
    }

    next();
  };
};

// Schemas de validação

// Autenticação
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email deve ter um formato válido',
    'any.required': 'Email é obrigatório'
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Senha deve ter pelo menos 6 caracteres',
    'any.required': 'Senha é obrigatória'
  }),
  name: Joi.string().min(2).max(100).required().messages({
    'string.min': 'Nome deve ter pelo menos 2 caracteres',
    'string.max': 'Nome não pode ter mais de 100 caracteres',
    'any.required': 'Nome é obrigatório'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email deve ter um formato válido',
    'any.required': 'Email é obrigatório'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Senha é obrigatória'
  })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token é obrigatório'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Senha atual é obrigatória'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Nova senha deve ter pelo menos 6 caracteres',
    'any.required': 'Nova senha é obrigatória'
  })
});

// Flow schemas
const nodeSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('connector', 'field-extractor', 'array-processor', 'variable', 'output', 'add', 'subtract', 'multiply', 'divide').required(),
  position: Joi.object({
    x: Joi.number().required(),
    y: Joi.number().required()
  }).required(),
  data: Joi.object().required()
});

const edgeSchema = Joi.object({
  id: Joi.string().required(),
  source: Joi.string().required(),
  target: Joi.string().required(),
  sourceHandle: Joi.string().allow(null),
  targetHandle: Joi.string().allow(null)
});

const flowDataSchema = Joi.object({
  nodes: Joi.array().items(nodeSchema).required(),
  edges: Joi.array().items(edgeSchema).required(),
  globalVariables: Joi.object().default({})
});

const createFlowSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.min': 'Nome do fluxo é obrigatório',
    'string.max': 'Nome não pode ter mais de 100 caracteres',
    'any.required': 'Nome do fluxo é obrigatório'
  }),
  description: Joi.string().max(500).allow('').messages({
    'string.max': 'Descrição não pode ter mais de 500 caracteres'
  }),
  category: Joi.string().max(100).required().messages({
    'string.max': 'Categoria não pode ter mais de 100 caracteres',
    'any.required': 'Categoria é obrigatória'
  }),
  isPublic: Joi.boolean().default(false)
});

const updateFlowSchema = Joi.object({
  name: Joi.string().min(1).max(100).messages({
    'string.min': 'Nome do fluxo é obrigatório',
    'string.max': 'Nome não pode ter mais de 100 caracteres'
  }),
  description: Joi.string().max(500).allow('').messages({
    'string.max': 'Descrição não pode ter mais de 500 caracteres'
  }),
  category: Joi.string().max(100).messages({
    'string.max': 'Categoria não pode ter mais de 100 caracteres'
  }),
  flowData: flowDataSchema,
  isPublic: Joi.boolean(),
  tags: Joi.array().items(Joi.string().trim())
});

// Execution schemas
const executeFlowSchema = Joi.object({
  inputData: Joi.object().default({}),
  options: Joi.object({
    saveResult: Joi.boolean().default(false),
    includeNodeResults: Joi.boolean().default(false),
    timeout: Joi.number().integer().min(1000).max(300000).default(60000)
  }).default({}),
  metadata: Joi.object({
    userAgent: Joi.string(),
    version: Joi.string()
  }).default({})
});

// Parâmetros
const mongoIdSchema = Joi.object({
  id: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required().messages({
    'string.pattern.base': 'ID deve ser um ObjectId válido do MongoDB'
  })
});

// Query parameters
const flowsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().allow(''),
  tags: Joi.string().allow(''),
  isPublic: Joi.boolean(),
  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'name', 'executionCount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const executionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('pending', 'running', 'completed', 'error', 'timeout'),
  flowId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
  sortBy: Joi.string().valid('createdAt', 'executionTime', 'status').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Connector schemas
const connectorExecuteSchema = Joi.object({
  sourceType: Joi.string().valid('api', 'analytics', 'sheets', 'mk3d', 'graphql', 'database', 'json').required().messages({
    'any.required': 'Tipo de fonte é obrigatório',
    'any.only': 'Tipo de fonte deve ser: api, analytics, sheets, mk3d, graphql, database ou json'
  }),
  config: Joi.object().required().messages({
    'any.required': 'Configuração é obrigatória'
  }),
  temporalConfig: Joi.object({
    enabled: Joi.boolean().default(false),
    rangeType: Joi.string().valid('relative', 'absolute').when('enabled', {
      is: true,
      then: Joi.required()
    }),
    relativeRange: Joi.string().valid('today', 'last_7_days', 'last_30_days', 'last_90_days', 'this_month', 'last_month').when('rangeType', {
      is: 'relative',
      then: Joi.required()
    }),
    absoluteRange: Joi.object({
      startDate: Joi.string().isoDate().required(),
      endDate: Joi.string().isoDate().required()
    }).when('rangeType', {
      is: 'absolute',
      then: Joi.required()
    }),
    timezone: Joi.string().default('UTC')
  }).default({ enabled: false }),
  transformations: Joi.object({
    filter: Joi.object(),
    limit: Joi.number().integer().min(1).max(1000),
    fields: Joi.array().items(Joi.string())
  })
});

// Profile schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).messages({
    'string.min': 'Nome deve ter pelo menos 2 caracteres',
    'string.max': 'Nome não pode ter mais de 100 caracteres'
  }),
  email: Joi.string().email().messages({
    'string.email': 'Email deve ter um formato válido'
  })
});

// Email verification schemas
const sendVerificationSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email deve ter um formato válido',
    'any.required': 'Email é obrigatório'
  })
});

const verifyEmailSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Token é obrigatório'
  })
});

// Password reset schemas
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email deve ter um formato válido',
    'any.required': 'Email é obrigatório'
  })
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Token é obrigatório'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Nova senha deve ter pelo menos 6 caracteres',
    'any.required': 'Nova senha é obrigatória'
  })
});

// Preferences schema
const updatePreferencesSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').messages({
    'any.only': 'Tema deve ser "light" ou "dark"'
  }),
  language: Joi.string().valid('pt-BR', 'en-US').messages({
    'any.only': 'Idioma deve ser "pt-BR" ou "en-US"'
  }),
  timezone: Joi.string().messages({
    'string.base': 'Timezone deve ser uma string válida'
  }),
  emailNotifications: Joi.boolean().messages({
    'boolean.base': 'emailNotifications deve ser true ou false'
  })
});

// Delete account schema
const deleteAccountSchema = Joi.object({
  password: Joi.string().required().messages({
    'any.required': 'Senha é obrigatória'
  }),
  confirmation: Joi.string().valid('DELETE').required().messages({
    'any.only': 'Confirmação deve ser "DELETE"',
    'any.required': 'Confirmação é obrigatória'
  })
});

// 2FA schemas
const enable2FASchema = Joi.object({
  password: Joi.string().required().messages({
    'any.required': 'Senha é obrigatória'
  })
});

const verify2FASchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'Token deve ter 6 dígitos',
    'string.pattern.base': 'Token deve conter apenas números',
    'any.required': 'Token é obrigatório'
  })
});

const disable2FASchema = Joi.object({
  password: Joi.string().required().messages({
    'any.required': 'Senha é obrigatória'
  }),
  token: Joi.string().length(6).pattern(/^\d+$/).required().messages({
    'string.length': 'Token deve ter 6 dígitos',
    'string.pattern.base': 'Token deve conter apenas números',
    'any.required': 'Token é obrigatório'
  })
});

module.exports = {
  validate,
  validateParams,
  validateQuery,

  // Auth schemas
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,

  // Flow schemas
  createFlowSchema,
  updateFlowSchema,
  executeFlowSchema,

  // Connector schemas
  connectorExecuteSchema,

  // Parameter schemas
  mongoIdSchema,

  // Query schemas
  flowsQuerySchema,
  executionsQuerySchema,

  // Profile schemas
  updateProfileSchema,

  // Email verification schemas
  sendVerificationSchema,
  verifyEmailSchema,

  // Password reset schemas
  forgotPasswordSchema,
  resetPasswordSchema,

  // Preferences schema
  updatePreferencesSchema,

  // Delete account schema
  deleteAccountSchema,

  // 2FA schemas
  enable2FASchema,
  verify2FASchema,
  disable2FASchema
};
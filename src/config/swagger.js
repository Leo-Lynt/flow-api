const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Flow-Forge API',
      version: '1.0.0',
      description: 'API backend para Flow-Forge - Ferramenta visual de transformação de dados',
      contact: {
        name: 'Flow-Forge Support',
        email: 'support@flowforge.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_URL || (process.env.NODE_ENV === 'production' ? 'https://flow-api-rho.vercel.app' : `http://localhost:${process.env.PORT || 3001}`),
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtido através do endpoint de login'
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de acesso é necessário',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  message: 'Token de acesso requerido',
                  code: 'MISSING_TOKEN',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        ValidationError: {
          description: 'Erro de validação dos dados de entrada',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  message: 'Email é obrigatório',
                  code: 'VALIDATION_ERROR',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  message: 'Fluxo não encontrado',
                  code: 'FLOW_NOT_FOUND',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Limite de requisições excedido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse'
              },
              example: {
                success: false,
                error: {
                  message: 'Muitas requisições. Tente novamente mais tarde.',
                  code: 'RATE_LIMIT_EXCEEDED',
                  timestamp: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        }
      },
      schemas: {
        // Schemas de resposta
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operação realizada com sucesso'
            },
            data: {
              type: 'object',
              description: 'Dados da resposta'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Erro ao processar requisição'
                },
                code: {
                  type: 'string',
                  example: 'GENERIC_ERROR'
                },
                details: {
                  type: 'object',
                  description: 'Detalhes adicionais do erro'
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                  example: '2024-01-01T00:00:00.000Z'
                }
              }
            }
          }
        },

        // Schemas de autenticação
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'João Silva'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@exemplo.com'
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'senha123'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@exemplo.com'
            },
            password: {
              type: 'string',
              example: 'senha123'
            }
          }
        },
        AuthResponse: {
          allOf: [
            { $ref: '#/components/schemas/SuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    user: {
                      $ref: '#/components/schemas/User'
                    },
                    accessToken: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    },
                    refreshToken: {
                      type: 'string',
                      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                    }
                  }
                }
              }
            }
          ]
        },
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b3'
            },
            name: {
              type: 'string',
              example: 'João Silva'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'joao@exemplo.com'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // Schemas de fluxos
        NodePosition: {
          type: 'object',
          required: ['x', 'y'],
          properties: {
            x: {
              type: 'number',
              example: 100
            },
            y: {
              type: 'number',
              example: 200
            }
          }
        },
        FlowNode: {
          type: 'object',
          required: ['id', 'type', 'position', 'data'],
          properties: {
            id: {
              type: 'string',
              example: 'connector_1640995200000'
            },
            type: {
              type: 'string',
              enum: ['connector', 'field-extractor', 'array-processor', 'variable', 'output', 'add', 'subtract', 'multiply', 'divide'],
              example: 'connector'
            },
            position: {
              $ref: '#/components/schemas/NodePosition'
            },
            data: {
              type: 'object',
              description: 'Configuração específica do nó',
              example: {
                label: 'Data Connector',
                sourceType: 'analytics',
                analyticsType: 'sales'
              }
            }
          }
        },
        FlowEdge: {
          type: 'object',
          required: ['id', 'source', 'target'],
          properties: {
            id: {
              type: 'string',
              example: 'edge_1'
            },
            source: {
              type: 'string',
              example: 'connector_1'
            },
            target: {
              type: 'string',
              example: 'field-extractor_1'
            },
            sourceHandle: {
              type: 'string',
              nullable: true
            },
            targetHandle: {
              type: 'string',
              nullable: true
            }
          }
        },
        FlowData: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b4'
            },
            flowId: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b3'
            },
            data: {
              type: 'object',
              nullable: true,
              description: 'Dados/lógica do flow definidos pelo usuário. Pode ser qualquer estrutura JSON',
              example: {
                nodes: [
                  {
                    id: 'node1',
                    type: 'input',
                    position: { x: 100, y: 100 }
                  }
                ],
                connections: [
                  {
                    from: 'node1',
                    to: 'node2'
                  }
                ],
                settings: {
                  theme: 'dark'
                }
              }
            },
            version: {
              type: 'number',
              example: 1,
              description: 'Versão do FlowData, incrementa a cada atualização'
            },
            lastModifiedBy: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b1',
              description: 'ID do usuário que fez a última modificação'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        CreateFlowRequest: {
          type: 'object',
          required: ['name', 'flowData'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'Meu Fluxo de Análise'
            },
            description: {
              type: 'string',
              maxLength: 500,
              example: 'Fluxo para analisar dados de vendas'
            },
            flowData: {
              $ref: '#/components/schemas/FlowData'
            },
            isPublic: {
              type: 'boolean',
              default: false,
              example: false
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['vendas', 'análise']
            }
          }
        },
        Flow: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b3'
            },
            name: {
              type: 'string',
              example: 'Análise de Vendas'
            },
            description: {
              type: 'string',
              example: 'Fluxo para analisar dados de vendas'
            },
            userId: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b2'
            },
            flowData: {
              $ref: '#/components/schemas/FlowData'
            },
            isPublic: {
              type: 'boolean',
              example: false
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['vendas', 'análise']
            },
            executionCount: {
              type: 'number',
              example: 5
            },
            lastExecutedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            nodeCount: {
              type: 'number',
              example: 4
            },
            connectionCount: {
              type: 'number',
              example: 3
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // Schemas de execução
        ExecuteFlowRequest: {
          type: 'object',
          properties: {
            inputData: {
              type: 'object',
              description: 'Dados de entrada para o fluxo',
              example: { userId: 123, period: '2024-01' }
            },
            metadata: {
              type: 'object',
              properties: {
                userAgent: {
                  type: 'string'
                },
                version: {
                  type: 'string'
                }
              }
            }
          }
        },
        Execution: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b3'
            },
            flowId: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b2'
            },
            userId: {
              type: 'string',
              example: '60f7b3b3b3b3b3b3b3b3b3b1'
            },
            inputData: {
              type: 'object',
              example: { userId: 123 }
            },
            outputData: {
              type: 'object',
              example: { total: 125000, count: 100 }
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'error', 'timeout'],
              example: 'completed'
            },
            executionTime: {
              type: 'number',
              description: 'Tempo de execução em milissegundos',
              example: 1250
            },
            duration: {
              type: 'string',
              description: 'Duração formatada',
              example: '1.25s'
            },
            statusDescription: {
              type: 'string',
              example: 'Concluída'
            },
            error: {
              type: 'object',
              nullable: true,
              properties: {
                message: {
                  type: 'string'
                },
                code: {
                  type: 'string'
                },
                nodeId: {
                  type: 'string'
                }
              }
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            completedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },

        // Schemas de paginação
        PaginationInfo: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              example: 1
            },
            limit: {
              type: 'number',
              example: 10
            },
            total: {
              type: 'number',
              example: 25
            },
            pages: {
              type: 'number',
              example: 3
            },
            hasNext: {
              type: 'boolean',
              example: true
            },
            hasPrev: {
              type: 'boolean',
              example: false
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Endpoints de autenticação e gerenciamento de usuários'
      },
      {
        name: 'Flows',
        description: 'Gerenciamento de fluxos de transformação de dados'
      },
      {
        name: 'FlowData',
        description: 'Gerenciamento dos dados e lógica dos fluxos'
      },
      {
        name: 'Executions',
        description: 'Execução e monitoramento de fluxos'
      },
      {
        name: 'System',
        description: 'Endpoints do sistema e monitoramento'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJSDoc(options);

module.exports = specs;
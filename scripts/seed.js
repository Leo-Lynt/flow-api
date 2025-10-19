require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Importar models
const User = require('../src/models/User');
const Flow = require('../src/models/Flow');
const Execution = require('../src/models/Execution');

const seedData = async () => {
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Limpar dados existentes
    await User.deleteMany({});
    await Flow.deleteMany({});
    await Execution.deleteMany({});
    console.log('🧹 Dados existentes removidos');

    // Criar usuário de teste
    const testUser = new User({
      name: 'Usuário Teste',
      email: 'teste@flowforge.com',
      password: 'senha123'
    });

    await testUser.save();
    console.log('👤 Usuário de teste criado:', testUser.email);

    // Criar fluxo de exemplo 1: Análise de Vendas
    const salesFlow = new Flow({
      name: 'Análise de Vendas',
      description: 'Fluxo que analisa dados de vendas e calcula estatísticas',
      userId: testUser._id,
      flowData: {
        nodes: [
          {
            id: 'connector_sales',
            type: 'connector',
            position: { x: 100, y: 100 },
            data: {
              label: 'Dados de Vendas',
              sourceType: 'analytics',
              analyticsType: 'sales'
            }
          },
          {
            id: 'extractor_amount',
            type: 'field-extractor',
            position: { x: 350, y: 100 },
            data: {
              label: 'Extrair Valores',
              fields: ['sales.amount'],
              extractionMode: 'values'
            }
          },
          {
            id: 'sum_total',
            type: 'array-processor',
            position: { x: 600, y: 100 },
            data: {
              label: 'Somar Total',
              operation: 'sum',
              field: ''
            }
          },
          {
            id: 'output_result',
            type: 'output',
            position: { x: 850, y: 100 },
            data: {
              label: 'Resultado Final',
              outputFormat: 'wrapped',
              includeMetadata: true
            }
          }
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'connector_sales',
            target: 'extractor_amount'
          },
          {
            id: 'edge_2',
            source: 'extractor_amount',
            target: 'sum_total'
          },
          {
            id: 'edge_3',
            source: 'sum_total',
            target: 'output_result'
          }
        ],
        globalVariables: {}
      },
      isPublic: true,
      tags: ['vendas', 'análise', 'exemplo']
    });

    await salesFlow.save();
    console.log('📊 Fluxo de vendas criado:', salesFlow.name);

    // Criar fluxo de exemplo 2: Processamento de Usuários
    const usersFlow = new Flow({
      name: 'Processamento de Usuários',
      description: 'Filtra usuários ativos e calcula estatísticas',
      userId: testUser._id,
      flowData: {
        nodes: [
          {
            id: 'connector_users',
            type: 'connector',
            position: { x: 100, y: 100 },
            data: {
              label: 'Dados de Usuários',
              sourceType: 'analytics',
              analyticsType: 'users'
            }
          },
          {
            id: 'filter_active',
            type: 'array-processor',
            position: { x: 350, y: 100 },
            data: {
              label: 'Filtrar Ativos',
              operation: 'filter',
              filterCondition: {
                field: 'users.isActive',
                operator: 'equals',
                value: true
              }
            }
          },
          {
            id: 'count_users',
            type: 'array-processor',
            position: { x: 600, y: 100 },
            data: {
              label: 'Contar Usuários',
              operation: 'count'
            }
          },
          {
            id: 'save_variable',
            type: 'variable',
            position: { x: 600, y: 250 },
            data: {
              label: 'Salvar Contador',
              operation: 'set',
              variableName: 'activeUsersCount'
            }
          },
          {
            id: 'output_stats',
            type: 'output',
            position: { x: 850, y: 100 },
            data: {
              label: 'Estatísticas',
              outputFormat: 'stats',
              includeMetadata: true
            }
          }
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'connector_users',
            target: 'filter_active'
          },
          {
            id: 'edge_2',
            source: 'filter_active',
            target: 'count_users'
          },
          {
            id: 'edge_3',
            source: 'count_users',
            target: 'save_variable'
          },
          {
            id: 'edge_4',
            source: 'count_users',
            target: 'output_stats'
          }
        ],
        globalVariables: {
          totalUsers: 0,
          lastProcessed: null
        }
      },
      isPublic: false,
      tags: ['usuários', 'filtros', 'estatísticas']
    });

    await usersFlow.save();
    console.log('👥 Fluxo de usuários criado:', usersFlow.name);

    // Criar fluxo de exemplo 3: Operações Matemáticas
    const mathFlow = new Flow({
      name: 'Calculadora Avançada',
      description: 'Demonstra operações matemáticas em sequência',
      userId: testUser._id,
      flowData: {
        nodes: [
          {
            id: 'input_number',
            type: 'connector',
            position: { x: 100, y: 100 },
            data: {
              label: 'Número Base',
              sourceType: 'input'
            }
          },
          {
            id: 'multiply_by_2',
            type: 'multiply',
            position: { x: 300, y: 100 },
            data: {
              label: 'Multiplicar por 2',
              operand: 2
            }
          },
          {
            id: 'add_10',
            type: 'add',
            position: { x: 500, y: 100 },
            data: {
              label: 'Somar 10',
              operand: 10
            }
          },
          {
            id: 'divide_by_3',
            type: 'divide',
            position: { x: 700, y: 100 },
            data: {
              label: 'Dividir por 3',
              operand: 3
            }
          },
          {
            id: 'output_calc',
            type: 'output',
            position: { x: 900, y: 100 },
            data: {
              label: 'Resultado',
              outputFormat: 'wrapped',
              includeMetadata: false
            }
          }
        ],
        edges: [
          {
            id: 'edge_1',
            source: 'input_number',
            target: 'multiply_by_2'
          },
          {
            id: 'edge_2',
            source: 'multiply_by_2',
            target: 'add_10'
          },
          {
            id: 'edge_3',
            source: 'add_10',
            target: 'divide_by_3'
          },
          {
            id: 'edge_4',
            source: 'divide_by_3',
            target: 'output_calc'
          }
        ],
        globalVariables: {}
      },
      isPublic: true,
      tags: ['matemática', 'cálculos', 'exemplo']
    });

    await mathFlow.save();
    console.log('🔢 Fluxo de matemática criado:', mathFlow.name);

    // Criar algumas execuções de exemplo
    const executions = [
      {
        flowId: salesFlow._id,
        userId: testUser._id,
        inputData: {},
        status: 'completed',
        outputData: { total: 125000, count: 100 },
        executionTime: 1250,
        startedAt: new Date(Date.now() - 60000),
        completedAt: new Date(Date.now() - 58750)
      },
      {
        flowId: usersFlow._id,
        userId: testUser._id,
        inputData: {},
        status: 'completed',
        outputData: { activeUsers: 42, totalUsers: 50 },
        executionTime: 890,
        startedAt: new Date(Date.now() - 120000),
        completedAt: new Date(Date.now() - 119110)
      },
      {
        flowId: mathFlow._id,
        userId: testUser._id,
        inputData: { value: 15 },
        status: 'completed',
        outputData: { result: 13.33 },
        executionTime: 50,
        startedAt: new Date(Date.now() - 30000),
        completedAt: new Date(Date.now() - 29950)
      }
    ];

    await Execution.insertMany(executions);
    console.log('⚡ Execuções de exemplo criadas:', executions.length);

    // Atualizar contadores dos fluxos
    await Flow.findByIdAndUpdate(salesFlow._id, {
      executionCount: 1,
      lastExecutedAt: executions[0].completedAt
    });

    await Flow.findByIdAndUpdate(usersFlow._id, {
      executionCount: 1,
      lastExecutedAt: executions[1].completedAt
    });

    await Flow.findByIdAndUpdate(mathFlow._id, {
      executionCount: 1,
      lastExecutedAt: executions[2].completedAt
    });

    console.log('✅ Seed concluído com sucesso!');
    console.log('\n📋 Dados criados:');
    console.log(`   👤 1 usuário: ${testUser.email}`);
    console.log(`   📊 3 fluxos: Análise de Vendas, Processamento de Usuários, Calculadora`);
    console.log(`   ⚡ 3 execuções de exemplo`);
    console.log('\n🔑 Para testar a API:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Senha: senha123`);

  } catch (error) {
    console.error('❌ Erro durante o seed:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Conexão com MongoDB fechada');
  }
};

// Executar seed se chamado diretamente
if (require.main === module) {
  seedData();
}

module.exports = seedData;
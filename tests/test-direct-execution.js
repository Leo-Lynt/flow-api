/**
 * Test Direct Flow Execution
 * Testa o executeFlowInternal diretamente, sem Mongoose
 */

const FlowExecutor = require('../src/services/flowExecutor');
const mongoose = require('mongoose');

// Conectar ao MongoDB
mongoose.connect('mongodb://localhost:27017/flow-forge')
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB erro:', err));

async function runTest() {
  console.log('🧪 Testing Direct Flow Execution\n');
  console.log('='.repeat(60));

  try {
    const flowId = '68ea5179e26aaf24ee8c2d49';

    console.log(`\n📝 Loading flow ${flowId}...\n`);

    // Buscar o flow do MongoDB
    const Flow = require('../src/models/Flow');
    const flow = await Flow.findById(flowId);

    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    console.log(`✅ Flow loaded: ${flow.name}\n`);
    console.log(`   Nodes: ${flow.flowData.nodes.length}`);
    console.log(`   Edges: ${flow.flowData.edges.length}\n`);

    console.log('⏱️  Starting execution...\n');

    const inputData = {};

    // Criar instância do executor
    const executor = new FlowExecutor();

    // Chamar executeFlowInternal diretamente
    const result = await executor.executeFlowInternal(flow, inputData, null);

    console.log('\n✅ Execution completed successfully!');
    console.log('\n📊 Results:');
    console.log('   Success:', result.success);
    console.log('   Output Data:', JSON.stringify(result.outputData, null, 2));
    console.log('   Executed Nodes:', result.executedNodes.length);
    console.log('   Global Variables:', JSON.stringify(result.globalVariables, null, 2));

    console.log('\n='.repeat(60));
    console.log('✅ Test passed!');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('   Error:', error.message);
    console.error('\n   Stack:', error.stack);
    console.log('\n='.repeat(60));
    console.log('❌ Test failed!');
    process.exit(1);
  }
}

// Aguardar conexão antes de executar
setTimeout(runTest, 1000);

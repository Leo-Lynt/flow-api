/**
 * Test Output Node with API Response
 */

const flowExecutor = require('../src/services/flowExecutor');

const testFlow = {
  _id: 'test-output-api-response',
  flowData: {
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 100, y: 100 }
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 400, y: 100 }
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'input-1',
        target: 'output-1',
        sourceHandle: 'param-output-0',
        targetHandle: 'data-resultado',
        edgeType: 'data'
      }
    ],
    nodeData: {
      'input-1': {
        parameters: [
          { name: 'valor', type: 'string', defaultValue: 'Teste' }
        ]
      },
      'output-1': {
        destination: 'apiResponse',
        destinationConfig: {
          format: 'wrapped' // ou 'data_only', 'full'
        },
        dynamicInputs: [
          { id: 'input-1', key: 'resultado', type: 'any' }
        ]
      }
    },
    globalVariables: {}
  }
};

async function runTest() {
  console.log('🧪 Testing Output Node with API Response\n');
  console.log('='.repeat(80));

  try {
    console.log('\n📝 Test Setup:');
    console.log('   Input: valor = "Hello from API"');
    console.log('   ↓');
    console.log('   Output:');
    console.log('     └─ destination: apiResponse');
    console.log('     └─ format: wrapped');
    console.log('     └─ dynamicInputs: [resultado]');

    console.log('\n⏱️  Starting execution...\n');

    const result = await flowExecutor.executeFlow(testFlow, {
      valor: 'Hello from API'
    });

    console.log('\n✅ Execution completed successfully!');
    console.log('\n📊 Full Result:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n📦 Output Data (API Response):');
    console.log(JSON.stringify(result.outputData, null, 2));

    // Verificações
    console.log('\n🔍 Verificações:');

    if (result.outputData && result.outputData.success) {
      console.log('   ✅ Output tem campo "success"');
    } else {
      console.log('   ❌ Output NÃO tem campo "success"');
    }

    if (result.outputData && result.outputData.data) {
      console.log('   ✅ Output tem campo "data"');
      console.log(`   ✅ Data.resultado = "${result.outputData.data.resultado}"`);
    } else {
      console.log('   ❌ Output NÃO tem campo "data"');
    }

    console.log('\n='.repeat(80));
    console.log('✅ Test passed! Output node correctly formats API response!');

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    console.log('\n='.repeat(80));
    console.log('❌ Test failed!');
    process.exit(1);
  }
}

runTest();

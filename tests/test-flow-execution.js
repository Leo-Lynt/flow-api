/**
 * Test Flow Execution
 * Testa o novo sistema de execução unificado
 */

const flowExecutor = require('../src/services/flowExecutor');

// Mock flow: Input -> Add -> Output
const testFlow = {
  _id: 'test-flow-id',
  flowData: {
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 100, y: 100 }
      },
      {
        id: 'add-1',
        type: 'add',
        position: { x: 300, y: 100 }
      },
      {
        id: 'output-1',
        type: 'output',
        position: { x: 500, y: 100 }
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'input-1',
        target: 'add-1',
        sourceHandle: 'param-output-0',
        targetHandle: 'data-a',
        edgeType: 'data'
      },
      {
        id: 'e2',
        source: 'input-1',
        target: 'add-1',
        sourceHandle: 'param-output-1',
        targetHandle: 'data-b',
        edgeType: 'data'
      },
      {
        id: 'e3',
        source: 'add-1',
        target: 'output-1',
        sourceHandle: 'data-out',
        targetHandle: 'data-input',
        edgeType: 'data'
      }
    ],
    nodeData: {
      'input-1': {
        parameters: [
          { name: 'valueA', type: 'number', defaultValue: 5 },
          { name: 'valueB', type: 'number', defaultValue: 10 }
        ]
      },
      'add-1': {},
      'output-1': {
        destination: 'display',
        dynamicInputs: [
          { key: 'input', label: 'Result' }
        ]
      }
    },
    globalVariables: {}
  }
};

async function runTest() {
  console.log('🧪 Testing Flow Execution System\n');
  console.log('='.repeat(60));

  try {
    console.log('\n📝 Test Flow:');
    console.log('   Input (valueA=5, valueB=10)');
    console.log('   ↓');
    console.log('   Add (a + b)');
    console.log('   ↓');
    console.log('   Output (display)');

    console.log('\n⏱️  Starting execution...\n');

    const inputData = {
      valueA: 7,
      valueB: 3
    };

    const result = await flowExecutor.executeFlow(testFlow, inputData);

    console.log('\n✅ Execution completed successfully!');
    console.log('\n📊 Results:');
    console.log('   Output Data:', JSON.stringify(result.outputData, null, 2));
    console.log('   \n   Node Results:');
    Object.entries(result.nodeResults).forEach(([nodeId, outputs]) => {
      console.log(`     ${nodeId}:`, JSON.stringify(outputs, null, 2));
    });

    console.log('\n='.repeat(60));
    console.log('✅ All tests passed!');

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('   Error:', error.message);
    console.error('\n   Stack:', error.stack);
    console.log('\n='.repeat(60));
    console.log('❌ Test failed!');
    process.exit(1);
  }
}

runTest();

/**
 * Test Debug Viewer
 */

const flowExecutor = require('../src/services/flowExecutor');

const testFlow = {
  _id: 'test-debug-viewer',
  flowData: {
    nodes: [
      {
        id: 'input-1',
        type: 'input',
        position: { x: 100, y: 100 }
      },
      {
        id: 'debug-viewer_1760187224353',
        type: 'debug-viewer',
        position: { x: 300, y: 100 }
      }
    ],
    edges: [
      {
        id: 'e1',
        source: 'input-1',
        target: 'debug-viewer_1760187224353',
        sourceHandle: 'param-output-0',
        targetHandle: 'data-input',
        edgeType: 'data'
      }
    ],
    nodeData: {
      'input-1': {
        parameters: [
          { name: 'testValue', type: 'string', defaultValue: 'Hello World' }
        ]
      },
      'debug-viewer_1760187224353': {
        label: 'Debug Viewer',
        expanded: true
      }
    },
    globalVariables: {}
  }
};

async function runTest() {
  console.log('🧪 Testing Debug Viewer\n');

  try {
    const result = await flowExecutor.executeFlow(testFlow, {
      testValue: 'Test Data'
    });

    console.log('\n✅ Execution completed successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

runTest();

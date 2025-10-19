/**
 * Test Mock Flow Execution
 * Testa o executeFlowInternal com flow mockado (sem MongoDB)
 */

const FlowExecutor = require('../src/services/flowExecutor');

// Flow real do frontend (68ea5179e26aaf24ee8c2d49)
const mockFlow = {
  _id: '68ea5179e26aaf24ee8c2d49',
  name: 'Test Flow with Variables',
  flowData: {
    nodes: [
      {
        id: 'connector_1760384699994',
        type: 'connector',
        position: { x: 300, y: 200 },
        data: {}
      },
      {
        id: 'array-filter_1760384772449',
        type: 'array-filter',
        position: { x: 600, y: 200 },
        data: {}
      },
      {
        id: 'array-aggregate_1760385163636',
        type: 'array-aggregate',
        position: { x: 900, y: 200 },
        data: {}
      },
      {
        id: 'object-create_1760385284930',
        type: 'object-create',
        position: { x: 1200, y: 200 },
        data: {}
      },
      {
        id: 'conditional-branch_1760469615974',
        type: 'conditional-branch',
        position: { x: 1500, y: 200 },
        data: {}
      },
      {
        id: 'variable_1760469645135',
        type: 'variable',
        position: { x: 1800, y: 100 },
        data: {}
      },
      {
        id: 'variable_1760469684948_0',
        type: 'variable',
        position: { x: 1800, y: 300 },
        data: {}
      },
      {
        id: 'variable_1760469717919',
        type: 'variable',
        position: { x: 2100, y: 200 },
        data: {}
      },
      {
        id: 'output_1760385340086',
        type: 'output',
        position: { x: 2400, y: 200 },
        data: {}
      }
    ],
    edges: [
      // connector -> array-filter
      {
        id: 'e1',
        source: 'connector_1760384699994',
        target: 'array-filter_1760384772449',
        sourceHandle: 'data-out',
        targetHandle: 'data-array',
        edgeType: 'data'
      },
      // array-filter -> array-aggregate
      {
        id: 'e2',
        source: 'array-filter_1760384772449',
        target: 'array-aggregate_1760385163636',
        sourceHandle: 'data-out',
        targetHandle: 'data-array',
        edgeType: 'data'
      },
      // array-aggregate -> object-create
      {
        id: 'e3',
        source: 'array-aggregate_1760385163636',
        target: 'object-create_1760385284930',
        sourceHandle: 'data-AddToCart',
        targetHandle: 'data-AddToCart',
        edgeType: 'data'
      },
      {
        id: 'e4',
        source: 'array-aggregate_1760385163636',
        target: 'object-create_1760385284930',
        sourceHandle: 'data-Users',
        targetHandle: 'data-Users',
        edgeType: 'data'
      },
      // object-create -> conditional-branch
      {
        id: 'e5',
        source: 'object-create_1760385284930',
        target: 'conditional-branch_1760469615974',
        sourceHandle: 'data-out',
        targetHandle: 'data-condition',
        edgeType: 'data'
      },
      // conditional-branch -> variable SET (TRUE)
      {
        id: 'e6',
        source: 'conditional-branch_1760469615974',
        target: 'variable_1760469645135',
        sourceHandle: 'exec-out-true',
        targetHandle: 'exec-in',
        edgeType: 'flow'
      },
      {
        id: 'e7',
        source: 'object-create_1760385284930',
        target: 'variable_1760469645135',
        sourceHandle: 'data-out',
        targetHandle: 'data-input',
        edgeType: 'data'
      },
      // conditional-branch -> variable SET (FALSE)
      {
        id: 'e8',
        source: 'conditional-branch_1760469615974',
        target: 'variable_1760469684948_0',
        sourceHandle: 'exec-out-false',
        targetHandle: 'exec-in',
        edgeType: 'flow'
      },
      {
        id: 'e9',
        source: 'object-create_1760385284930',
        target: 'variable_1760469684948_0',
        sourceHandle: 'data-out',
        targetHandle: 'data-input',
        edgeType: 'data'
      },
      // variable GET -> output
      {
        id: 'e10',
        source: 'variable_1760469717919',
        target: 'output_1760385340086',
        sourceHandle: 'data-out',
        targetHandle: 'data-input',
        edgeType: 'data'
      }
    ],
    nodeData: {
      'connector_1760384699994': {
        sourceType: 'ga4',
        apiId: '6631c8c5d2bf3d518d2e8fca',
        selectedEndpoint: 'GET /ga4/reports/events',
        parameters: {},
        mockData: [
          { eventName: 'add_to_cart', users: 30 },
          { eventName: 'add_to_cart', users: 50 },
          { eventName: 'page_view', users: 80 },
          { eventName: 'add_to_cart', users: 81 }
        ]
      },
      'array-filter_1760384772449': {
        filterCondition: 'eventName === "add_to_cart"',
        dynamicInputs: []
      },
      'array-aggregate_1760385163636': {
        groupBy: 'eventName',
        aggregations: [
          { key: 'AddToCart', operation: 'count', field: 'eventName' },
          { key: 'Users', operation: 'sum', field: 'users' }
        ]
      },
      'object-create_1760385284930': {
        dynamicInputs: [
          { key: 'AddToCart', label: 'AddToCart' },
          { key: 'Users', label: 'Users' }
        ]
      },
      'conditional-branch_1760469615974': {
        condition: 'true',
        dynamicInputs: []
      },
      'variable_1760469645135': {
        variableName: 'Variable01',
        mode: 'set',
        dynamicInputs: []
      },
      'variable_1760469684948_0': {
        variableName: 'Variable01',
        mode: 'set',
        dynamicInputs: []
      },
      'variable_1760469717919': {
        variableName: 'Variable01',
        mode: 'get',
        dynamicInputs: []
      },
      'output_1760385340086': {
        destination: 'api-response',
        dynamicInputs: [
          { key: 'input', label: 'Data' }
        ]
      }
    },
    globalVariables: {}
  }
};

async function runTest() {
  console.log('🧪 Testing Mock Flow Execution\n');
  console.log('='.repeat(60));

  try {
    console.log(`\n📝 Flow: ${mockFlow.name}`);
    console.log(`   Nodes: ${mockFlow.flowData.nodes.length}`);
    console.log(`   Edges: ${mockFlow.flowData.edges.length}\n`);

    console.log('⏱️  Starting execution...\n');

    const inputData = {};

    // Usar instância singleton do executor
    const executor = FlowExecutor;

    // Inicializar registry
    await executor.initialize();

    // Chamar executeFlowInternal diretamente
    const result = await executor.executeFlowInternal(mockFlow, inputData, null);

    console.log('\n✅ Execution completed!');
    console.log('\n📊 Results:');
    console.log('   Success:', result.success);
    console.log('   Output Data:', JSON.stringify(result.outputData, null, 2));
    console.log('   Executed Nodes:', result.executedNodes.length);
    console.log('   Global Variables:', JSON.stringify(result.globalVariables, null, 2));

    console.log('\n🎯 Expected Output:');
    console.log('   { AddToCart: 30, Users: 161 }');

    console.log('\n='.repeat(60));

    // Verificar se o resultado está correto
    const outputData = result.outputData?.data;
    if (outputData && outputData.AddToCart === 30 && outputData.Users === 161) {
      console.log('✅ Test PASSED! Output matches expected values.');
    } else {
      console.log('⚠️  Test INCOMPLETE. Output does not match expected values.');
      console.log('   Expected: { AddToCart: 30, Users: 161 }');
      console.log('   Got:', JSON.stringify(outputData, null, 2));
    }

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

runTest();

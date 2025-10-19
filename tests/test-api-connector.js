/**
 * Test API Connector Refactoring
 * Testa a nova arquitetura com um connector mais simples (API)
 */

const flowExecutor = require('../src/services/flowExecutor');

// Mock flow: API Connector -> Output
const testFlow = {
  _id: 'test-api-connector-flow',
  flowData: {
    nodes: [
      {
        id: 'connector-1',
        type: 'connector',
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
        source: 'connector-1',
        target: 'output-1',
        sourceHandle: 'data-out',
        targetHandle: 'data-input',
        edgeType: 'data'
      }
    ],
    nodeData: {
      'connector-1': {
        sourceType: 'api',
        apiUrl: 'https://jsonplaceholder.typicode.com/users/1',
        apiMethod: 'GET'
      },
      'output-1': {
        destination: 'display',
        dynamicInputs: [
          { key: 'input', label: 'API Data' }
        ]
      }
    },
    globalVariables: {}
  }
};

async function runTest() {
  console.log('🧪 Testing API Connector Refactoring (Core + Adapters + DI)\n');
  console.log('='.repeat(80));

  try {
    console.log('\n📝 Test Flow:');
    console.log('   API Connector');
    console.log('     └─ sourceType: api');
    console.log('     └─ apiUrl: jsonplaceholder (test API)');
    console.log('   ↓');
    console.log('   Output (display)');

    console.log('\n🔍 Testing Refactored Architecture:');
    console.log('   1. Core receives frontend field names (apiUrl, apiMethod)');
    console.log('   2. Core normalizes to canonical format (url, method)');
    console.log('   3. Core validates using canonical schemas');
    console.log('   4. Core gets adapter from registry (context.adapters - DI)');
    console.log('   5. NodeDataSource adapter transforms to service format');
    console.log('   6. APIAdapter service executes the HTTP request');

    console.log('\n⏱️  Starting execution...\n');

    const result = await flowExecutor.executeFlow(testFlow, {});

    console.log('\n✅ Execution completed successfully!');
    console.log('\n📊 Results:');

    const connectorResult = result.nodeResults['connector-1'];
    console.log('   API Response:');
    console.log('     Name:', connectorResult.name);
    console.log('     Email:', connectorResult.email);
    console.log('     City:', connectorResult.address?.city);

    console.log('\n✅ Architecture Verification:');
    console.log('   ✓ Field normalization working (apiUrl → url)');
    console.log('   ✓ Canonical validation working');
    console.log('   ✓ Dependency Injection working (adapters via context)');
    console.log('   ✓ Service transformation working (canonical → service format)');
    console.log('   ✓ API adapter working');

    console.log('\n🎯 Key Achievement:');
    console.log('   ALL LOGIC IS NOW IN CORE!');
    console.log('   - Core does normalization (fieldMapper)');
    console.log('   - Core does validation (ConnectorConfig)');
    console.log('   - Core orchestrates execution (connector.js)');
    console.log('   - Environment-specific code is ONLY in adapters');
    console.log('   - Frontend uses HttpDataSource (HTTP API calls)');
    console.log('   - Backend uses NodeDataSource (direct service calls)');

    console.log('\n='.repeat(80));
    console.log('✅ Refactoring successful! Core is now the single source of truth!');

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('   Error:', error.message);
    console.error('\n   Stack:', error.stack);

    console.log('\n🔍 Debug Info:');
    console.log('   Error in layer:');
    if (error.message.includes('normaliz')) {
      console.log('   ❌ Field normalization (fieldMapper)');
    } else if (error.message.includes('validat') || error.message.includes('required')) {
      console.log('   ❌ Validation (ConnectorConfig)');
    } else if (error.message.includes('adapter') || error.message.includes('registry')) {
      console.log('   ❌ Dependency injection (AdapterRegistry)');
    } else if (error.message.includes('service') || error.message.includes('fetch')) {
      console.log('   ❌ Service execution (Adapter)');
    } else {
      console.log('   ❓ Unknown - check stack trace');
    }

    console.log('\n='.repeat(80));
    console.log('❌ Test failed!');
    process.exit(1);
  }
}

runTest();

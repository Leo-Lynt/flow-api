/**
 * Test Real Flow Execution
 * Executa flow real do MongoDB usando método interno
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const FlowExecutor = require('../src/services/flowExecutor');
const Flow = require('../src/models/Flow');
const FlowData = require('../src/models/FlowData');

const FLOW_ID = '68ea5179e26aaf24ee8c2d49';

const INPUT_DATA = {
  "StartData": "2025-06-01",
  "EndData": "2025-06-03",
  "GetTxCovn": false
};

async function runTest() {
  console.log('🧪 Testing Real Flow Execution\n');
  console.log('='.repeat(60));

  try {
    // Conectar ao MongoDB (usar URI do .env)
    require('dotenv').config();
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Buscar flow com populate de flowData
    console.log(`📝 Loading flow ${FLOW_ID}...`);
    const flow = await Flow.findById(FLOW_ID).populate('flowDataId');

    if (!flow) {
      throw new Error(`Flow ${FLOW_ID} not found`);
    }

    console.log(`✅ Flow loaded: ${flow.name}`);

    // flowData está em flowDataId.data após populate
    const flowData = flow.flowDataId?.data;

    if (!flowData || !flowData.nodes) {
      throw new Error('Flow has no flowData or nodes');
    }

    console.log(`   Nodes: ${flowData.nodes.length}`);
    console.log(`   Edges: ${flowData.edges.length}\n`);

    // Inicializar executor
    console.log('⚙️  Initializing executor...');
    await FlowExecutor.initialize();
    console.log('✅ Executor initialized\n');

    // Montar objeto flow como esperado pelo executor
    const flowForExecution = {
      _id: flow._id,
      name: flow.name,
      flowData: {
        nodes: flowData.nodes,
        edges: flowData.edges,
        nodeData: flowData.nodeData,
        globalVariables: {}
      }
    };

    // Executar
    console.log('⏱️  Starting execution...\n');
    const result = await FlowExecutor.executeFlowInternal(flowForExecution, INPUT_DATA, null);

    console.log('\n✅ Execution completed!\n');
    console.log('='.repeat(60));
    console.log('\n📊 Results:');
    console.log('   Success:', result.success);
    console.log('   Output Data:', JSON.stringify(result.outputData, null, 2));
    console.log('   Executed Nodes:', result.executedNodes.length);
    console.log('   Global Variables:', JSON.stringify(result.globalVariables, null, 2));

    console.log('\n📝 Node Outputs:\n');
    console.log('='.repeat(60));
    Object.entries(result.nodeResults).forEach(([nodeId, output]) => {
      const node = flowData.nodes.find(n => n.id === nodeId);
      const nodeType = node ? node.type : 'unknown';
      console.log(`\n🔹 ${nodeId} (${nodeType})`);
      console.log('   Output:', JSON.stringify(output, null, 2));
    });

    console.log('\n🎯 Expected Output:');
    console.log('   { AddToCart: 30, Users: 161 }');

    console.log('\n' + '='.repeat(60));

    // Salvar execução em JSON
    const executionReport = {
      flowId: FLOW_ID,
      flowName: flow.name,
      timestamp: new Date().toISOString(),
      inputData: INPUT_DATA,
      success: result.success,
      error: result.error || null,
      executedNodes: result.executedNodes,
      globalVariables: result.globalVariables,
      outputData: result.outputData,
      nodeOutputs: Object.entries(result.nodeResults).map(([nodeId, output]) => {
        const node = flowData.nodes.find(n => n.id === nodeId);
        return {
          nodeId,
          nodeType: node ? node.type : 'unknown',
          position: node ? node.position : null,
          output: output
        };
      }),
      flowStructure: {
        totalNodes: flowData.nodes.length,
        totalEdges: flowData.edges.length,
        nodes: flowData.nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position
        })),
        edges: flowData.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          edgeType: e.edgeType
        }))
      }
    };

    const reportPath = path.join(__dirname, 'execution-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(executionReport, null, 2));
    console.log(`\n💾 Execution report saved to: ${reportPath}`);

    // Fechar conexão
    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Execution failed:');
    console.error('   Error:', error.message);

    console.log('\n' + '='.repeat(60));

    await mongoose.connection.close();
    process.exit(1);
  }
}

runTest();

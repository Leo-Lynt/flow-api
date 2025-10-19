/**
 * Generate Execution Summary
 * Cria resumo compacto da execução
 */

const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'execution-report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const summary = {
  flowId: report.flowId,
  flowName: report.flowName,
  timestamp: report.timestamp,
  inputData: report.inputData,
  success: report.success,
  error: report.error,
  executedNodesCount: report.executedNodes.length,
  globalVariables: report.globalVariables,
  outputData: report.outputData,

  nodeExecutionOrder: report.executedNodes,

  nodeOutputsSummary: report.nodeOutputs.map(node => ({
    nodeId: node.nodeId,
    nodeType: node.nodeType,
    position: node.position,
    outputType: Array.isArray(node.output) ? 'array' : typeof node.output,
    outputLength: Array.isArray(node.output) ? node.output.length : undefined,
    output: Array.isArray(node.output)
      ? `[${node.output.length} items]${node.output.length > 0 ? ' - First: ' + JSON.stringify(node.output[0]).substring(0, 100) : ''}`
      : node.output
  })),

  flowStructure: {
    totalNodes: report.flowStructure.totalNodes,
    totalEdges: report.flowStructure.totalEdges,
    nodesByType: report.flowStructure.nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {})
  }
};

const summaryPath = path.join(__dirname, 'execution-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('✅ Summary saved to:', summaryPath);
console.log('\n📊 Quick Stats:');
console.log('   Success:', summary.success);
console.log('   Executed Nodes:', summary.executedNodesCount);
console.log('   Output:', JSON.stringify(summary.outputData, null, 2));

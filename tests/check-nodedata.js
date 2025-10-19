const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Flow = require('../src/models/Flow');
const FlowData = require('../src/models/FlowData');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);

  const flow = await Flow.findById('68ea5179e26aaf24ee8c2d49').populate('flowDataId');
  const flowData = flow.flowDataId.data;

  const nodeData = flowData.nodeData['array-filter_1760230083728'];

  console.log('array-filter_1760230083728 nodeData:');
  console.log(JSON.stringify(nodeData, null, 2));

  await mongoose.connection.close();
}

check();

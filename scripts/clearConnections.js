require('dotenv').config();
const mongoose = require('mongoose');

async function clearConnections() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Conectado ao MongoDB');

    const result = await mongoose.connection.db.collection('connections').deleteMany({});
    console.log(`🗑️  ${result.deletedCount} conexões removidas`);

    await mongoose.connection.close();
    console.log('✅ Pronto! Agora você pode reconectar com a nova chave.');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

clearConnections();
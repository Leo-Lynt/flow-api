/**
 * Script de Migração: Google Connections
 *
 * Migra conexões antigas (google_analytics, google_sheets) para o novo formato unificado
 *
 * Como executar:
 * node scripts/migrate-google-connections.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Connection = require('../src/models/Connection');

async function migrateConnections() {
  try {
    console.log('🔄 Iniciando migração de conexões Google...\n');

    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // 1. Migrar google_analytics → google + serviceType: 'analytics'
    const analyticsConnections = await Connection.find({ provider: 'google_analytics' });
    console.log(`📊 Encontradas ${analyticsConnections.length} conexões google_analytics`);

    for (const conn of analyticsConnections) {
      conn.provider = 'google';
      conn.serviceType = 'analytics';
      conn.purpose = 'connection';
      await conn.save();
      console.log(`  ✓ Migrada: ${conn.name} (${conn._id})`);
    }

    // 2. Migrar google_sheets → google + serviceType: 'sheets'
    const sheetsConnections = await Connection.find({ provider: 'google_sheets' });
    console.log(`\n📊 Encontradas ${sheetsConnections.length} conexões google_sheets`);

    for (const conn of sheetsConnections) {
      conn.provider = 'google';
      conn.serviceType = 'sheets';
      conn.purpose = 'connection';
      await conn.save();
      console.log(`  ✓ Migrada: ${conn.name} (${conn._id})`);
    }

    // 3. Estatísticas finais
    console.log('\n📈 Estatísticas finais:');
    const googleConnections = await Connection.find({ provider: 'google' });
    const byServiceType = {};

    for (const conn of googleConnections) {
      const type = conn.serviceType || 'generic';
      byServiceType[type] = (byServiceType[type] || 0) + 1;
    }

    console.log(`  Total de conexões Google: ${googleConnections.length}`);
    Object.entries(byServiceType).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`);
    });

    console.log('\n✅ Migração concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Desconectado do MongoDB');
  }
}

// Executar migração
if (require.main === module) {
  migrateConnections()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = migrateConnections;

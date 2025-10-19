require('dotenv').config();
const connectorService = require('../src/services/connectorService');

async function testConnection() {
  try {
    console.log('🧪 Testando conexão Google Analytics...\n');

    const result = await connectorService.execute({
      sourceType: 'analytics',
      config: {
        connectionId: '68daf72e1cdf4cc1a29fb251', // ID da sua conexão
        propertyId: '123456789' // ← COLOQUE SEU GA4 PROPERTY ID AQUI
      },
      temporalConfig: {
        enabled: true,
        rangeType: 'relative',
        relativeRange: 'last_7_days'
      },
      userId: '68d85d90c0a55c750b753ffd' // Seu userId
    });

    console.log('✅ Sucesso!');
    console.log('Total de registros:', result.metadata.totalRecords);
    console.log('Primeiros dados:', JSON.stringify(result.data.slice(0, 3), null, 2));

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
  }
}

testConnection();
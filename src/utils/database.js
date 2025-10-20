const mongoose = require('mongoose');

// Detectar ambiente serverless
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;

const connectDB = async () => {
  try {
    // Opções otimizadas para serverless
    const options = {
      maxPoolSize: isServerless ? 10 : 50, // Pool menor em serverless
      minPoolSize: isServerless ? 2 : 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4 // Força IPv4 (mais rápido no Vercel)
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`📦 MongoDB conectado: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('Erro ao conectar MongoDB:', error.message);

    // Em serverless, não fazer process.exit - deixar a função falhar graciosamente
    if (!isServerless) {
      process.exit(1);
    }

    throw error; // Propagar erro para o middleware lidar
  }
};

// Eventos de conexão
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose conectado ao MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Erro na conexão Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose desconectado');
});

// Fechar conexão graciosamente (apenas em ambientes tradicionais)
if (!isServerless) {
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('🔌 Conexão MongoDB fechada devido ao término da aplicação');
    process.exit(0);
  });
}

module.exports = connectDB;
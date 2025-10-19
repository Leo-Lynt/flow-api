require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function makeAdmin() {
  try {
    // Conectar ao MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/flow-forge');
    console.log('✓ Conectado ao MongoDB');

    // ID do usuário
    const userId = '68d85d90c0a55c750b753ffd';

    // Buscar usuário
    const user = await User.findById(userId);

    if (!user) {
      console.error('✗ Usuário não encontrado');
      process.exit(1);
    }

    console.log(`\nUsuário encontrado:`);
    console.log(`  Nome: ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role atual: ${user.role}`);

    // Atualizar para administrator
    user.role = 'administrator';
    await user.save();

    console.log(`\n✓ Usuário atualizado com sucesso!`);
    console.log(`  Novo role: ${user.role}`);

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

makeAdmin();

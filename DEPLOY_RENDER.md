# 🚀 Deploy da Flow-Forge API no Render

## 📋 Pré-requisitos

1. Conta no [Render](https://render.com)
2. Conta no [MongoDB Atlas](https://cloud.mongodb.com) (para database)
3. Repositório no GitHub

## 🎯 Passo a Passo

### 1️⃣ Preparar MongoDB Atlas

1. Acesse [MongoDB Atlas](https://cloud.mongodb.com)
2. Crie um cluster gratuito (M0)
3. Configure Network Access: Add IP Address → Allow from Anywhere (0.0.0.0/0)
4. Crie um usuário de database
5. Pegue a connection string (formato: `mongodb+srv://user:pass@cluster.mongodb.net/dbname`)

### 2️⃣ Deploy no Render

#### Opção A: Via Dashboard (Recomendado)

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **"New +"** → **"Web Service"**
3. Conecte seu GitHub e selecione o repositório `flow-api`
4. Configure:
   - **Name**: `flow-forge-api`
   - **Region**: Oregon (USA West) ou Frankfurt (Europe)
   - **Branch**: `main`
   - **Root Directory**: `packages/api` (se for monorepo) ou deixe vazio
   - **Runtime**: Node
   - **Build Command**: `npm install --production`
   - **Start Command**: `node ./bin/www`
   - **Instance Type**: Free

5. Adicione as variáveis de ambiente:

```env
NODE_ENV=production
PORT=10000

# MongoDB (Obrigatório)
MONGODB_URI=mongodb+srv://...

# JWT (Obrigatório - gere valores únicos)
JWT_SECRET=seu_jwt_secret_aqui_min_32_chars
JWT_REFRESH_SECRET=seu_refresh_secret_aqui_min_32_chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS (Adicione seus domínios)
ALLOWED_ORIGINS=https://seu-frontend.vercel.app,https://outro-dominio.com

# Outros (configure conforme necessário)
TRUST_PROXY=true
ENCRYPTION_KEY=chave_32_bytes_hex

# Google OAuth (Opcional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://flow-forge-api.onrender.com/api/oauth/google/callback
FRONTEND_URL=https://seu-frontend.vercel.app

# SMTP (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
```

6. Clique em **"Create Web Service"**

#### Opção B: Via Blueprint (Automático)

1. Commit o arquivo `render.yaml` no repositório
2. No Render Dashboard, clique em **"New +"** → **"Blueprint"**
3. Conecte o repositório
4. Render detectará o `render.yaml` automaticamente
5. Configure as variáveis sensíveis no Dashboard

### 3️⃣ Configurar Domínio Customizado (Opcional)

1. No Dashboard do serviço, vá em **"Settings"** → **"Custom Domains"**
2. Adicione seu domínio
3. Configure o DNS conforme instruções do Render

### 4️⃣ Configurar Cron Jobs (Opcional)

Para schedulers/tarefas agendadas:

1. No Dashboard, vá em **"Jobs"** → **"New Cron Job"**
2. Configure:
   - Schedule: Use cron syntax (ex: `0 * * * *` para cada hora)
   - Command: Endpoint HTTP ou comando Node.js

## ✅ Funcionalidades que FUNCIONAM no Render

- ✅ **Socket.io / WebSockets** - Funcionam perfeitamente!
- ✅ **Schedulers internos** - node-cron funciona!
- ✅ **Sistema de arquivos** - Persistente (mas use cloud storage para uploads)
- ✅ **Logs em arquivo** - Winston daily-rotate funciona
- ✅ **Deploy automático** - Push para GitHub = deploy automático
- ✅ **Health checks** - Configurado em `/health`
- ✅ **HTTPS automático** - SSL gratuito incluído

## ⚠️ Limitações do Free Tier

- App dorme após 15 minutos de inatividade
- Acorda automaticamente (5-30 segundos de delay)
- 750 horas/mês (suficiente para 1 app rodando 24/7)
- Bandwidth limitado a 100 GB/mês
- Sem backup automático (faça backup do MongoDB)

## 🔧 Comandos Úteis

```bash
# Verificar logs
https://dashboard.render.com → Seu serviço → Logs

# Forçar redeploy
Dashboard → Deploy → Manual Deploy

# Executar comandos no servidor
Dashboard → Shell → Digite comandos Node.js/Bash
```

## 🆚 Render vs Vercel

| Feature | Render | Vercel |
|---------|--------|--------|
| Tipo | Servidor persistente | Serverless |
| WebSockets | ✅ Funciona | ❌ Não funciona |
| Cron Jobs | ✅ Funciona | ⚠️ Limitado |
| File System | ✅ Persistente | ❌ Read-only |
| Cold Start | 5-30s após sleep | 0-5s sempre |
| Free Tier | 750h/mês | Ilimitado* |
| Melhor para | APIs completas | Sites/APIs simples |

## 📝 Notas Finais

1. **Monitoramento**: Use [UptimeRobot](https://uptimerobot.com) para manter app acordado
2. **Logs**: Configure log aggregator externo para análise avançada
3. **Backup**: Configure backup automático do MongoDB Atlas
4. **Scaling**: Upgrade para paid tier quando necessário ($7/mês)

## 🔗 Links Úteis

- [Render Docs](https://render.com/docs)
- [Node on Render](https://render.com/docs/deploy-node-express-app)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)
- [Render Status](https://status.render.com)

---

**Dúvidas?** Abra uma issue no GitHub ou consulte a documentação oficial do Render.
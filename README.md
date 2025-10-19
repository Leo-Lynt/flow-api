# @flow-forge/api

**Adapter Layer** para FlowForge - API REST que conecta Frontend ao Core usando CommonJS + Dynamic Imports.

## 📦 O que é a API?

A API é a camada intermediária do FlowForge que:

- 🔌 **Adapta**: Converte requisições HTTP em execuções de flows
- 📡 **Serve**: Disponibiliza nodes.json via endpoint REST
- 🗄️ **Persiste**: Gerencia flows, execuções e usuários no MongoDB
- 🔐 **Autentica**: JWT com refresh tokens
- 🎯 **Executa**: Orquestra execução de flows usando Core

## 🏗️ Estrutura

```
packages/api/src/
├── controllers/         # Controladores REST
│   ├── authController.js
│   ├── flowController.js
│   ├── executionController.js
│   └── nodesController.js    # ✨ Serve nodes.json do Core
│
├── routes/              # Rotas da API
│   ├── authRoutes.js
│   ├── flowRoutes.js
│   ├── executionRoutes.js
│   └── nodesRoutes.js         # ✨ GET /api/nodes
│
├── services/            # Lógica de negócio
│   ├── flowExecutor.js        # ✨ Executa flows via Core
│   └── connectors/            # Implementações server-side
│
├── adapters/            # Adapters para Core
│   └── NodeDataSource.js      # ✨ Adapta data sources via Core mappings
│
├── engine/              # Engine adaptado
│   └── registry.js            # ✨ Carrega methods do Core via dynamic import
│
├── models/              # Schemas MongoDB
│   ├── User.js
│   ├── Flow.js
│   └── Execution.js
│
├── middleware/          # Middlewares
│   ├── auth.js
│   ├── rateLimit.js
│   └── errorHandler.js
│
└── utils/               # Utilitários
    ├── logger.js
    └── validators.js
```

## 🚀 Instalação

```bash
cd packages/api
pnpm install
```

## ⚙️ Configuração

Crie `.env`:

```env
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/flow-forge

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth (opcional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173
```

## ▶️ Executar

```bash
# Desenvolvimento (com nodemon)
pnpm dev

# Produção
pnpm start
```

API estará disponível em `http://localhost:3001`

## 📚 Endpoints Principais

### Nodes - `/api/nodes`

**Serve nodes.json do Core via API**

```bash
# Buscar catálogo de nodes
GET /api/nodes

# Resposta
{
  "success": true,
  "data": {
    "categories": [...],
    "nodes": [...]
  },
  "version": 1234567890,
  "cached": true
}

# Limpar cache (dev)
POST /api/nodes/clear-cache
```

### Autenticação - `/api/auth`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/register` | Registrar usuário |
| POST | `/login` | Login com email/senha |
| POST | `/refresh` | Renovar token |
| POST | `/logout` | Logout |
| GET | `/profile` | Obter perfil |
| PUT | `/profile` | Atualizar perfil |
| PUT | `/change-password` | Alterar senha |
| GET | `/google` | Login com Google OAuth |
| GET | `/google/callback` | Callback OAuth |

### Flows - `/api/flows`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar flows do usuário |
| POST | `/` | Criar flow |
| GET | `/:id` | Obter flow |
| PUT | `/:id` | Atualizar flow |
| DELETE | `/:id` | Deletar flow |
| POST | `/:id/execute` | **Executar flow** |
| POST | `/:id/clone` | Clonar flow |
| GET | `/:id/stats` | Estatísticas |
| GET | `/public` | Flows públicos |

### Execuções - `/api/executions`

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/` | Listar execuções |
| POST | `/` | Nova execução |
| GET | `/:id` | Obter execução |
| POST | `/:id/cancel` | Cancelar |
| POST | `/:id/reexecute` | Reexecutar |
| GET | `/stats` | Estatísticas |

### Sistema

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/api/docs` | Swagger UI |

## 🔧 Como a API usa o Core

### 1. Dynamic Import (Hybrid Architecture)

A API é CommonJS, mas importa Core (ES Modules) via `import()`:

```javascript
// ❌ Não funciona: import estático
// import { mappings } from '@flow-forge/core/config/mappings.js'

// ✅ Funciona: dynamic import
const mappings = await import('@flow-forge/core/config/mappings.js')
const { CANONICAL_TO_SERVICE } = mappings
```

### 2. Servir nodes.json via API

**Controller:** `controllers/nodesController.js`

```javascript
const path = require('path')
const fs = require('fs').promises

let nodesCache = null
let nodesCacheTime = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

async function loadNodesFromCore() {
  if (nodesCache && (Date.now() - nodesCacheTime) < CACHE_TTL) {
    return nodesCache
  }

  const nodesPath = path.join(__dirname, '../../../core/src/config/nodes.json')
  const nodesContent = await fs.readFile(nodesPath, 'utf8')
  nodesCache = JSON.parse(nodesContent)
  nodesCacheTime = Date.now()

  return nodesCache
}

async function getNodes(req, res) {
  try {
    const nodes = await loadNodesFromCore()
    res.json({
      success: true,
      data: nodes,
      version: nodesCacheTime,
      cached: nodesCache !== null
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: 'Erro ao carregar nodes do Core' }
    })
  }
}
```

### 3. Executar Flows via Core

**Service:** `services/flowExecutor.js`

```javascript
const registry = require('../engine/registry')
const NodeDataSourceFactory = require('../adapters/NodeDataSource')

async function executeFlow(nodes, edges, config) {
  // 1. Preparar adapters (usa mappings do Core)
  const nodeAdapters = await NodeDataSourceFactory.createAll()

  // 2. Executar cada node
  for (const node of sortedNodes) {
    // 3. Carregar method do Core via registry
    const method = await registry.getFunction(node.type, node.data.function)

    // 4. Executar
    const result = await method({
      nodeData: node,
      inputs: inputData,
      context: executionContext
    })

    results[node.id] = result
  }

  return results
}
```

### 4. Registry com Dynamic Import

**Engine:** `engine/registry.js`

```javascript
async function loadMethod(nodeType, functionName) {
  const modulePath = `@flow-forge/core/methods/${category}/${nodeType}.js`

  try {
    // Dynamic import do Core
    const module = await import(modulePath)

    if (typeof module[functionName] !== 'function') {
      throw new Error(`Function ${functionName} not found`)
    }

    return module[functionName]
  } catch (error) {
    throw new Error(`Failed to load method: ${error.message}`)
  }
}
```

### 5. Adapter com Mappings do Core

**Adapter:** `adapters/NodeDataSource.js`

```javascript
let CANONICAL_TO_SERVICE_FIELDS = null
let SOURCE_TYPE_MAPPINGS = null

async function loadMappingsFromCore() {
  if (!CANONICAL_TO_SERVICE_FIELDS) {
    const mappings = await import('@flow-forge/core/config/mappings.js')
    CANONICAL_TO_SERVICE_FIELDS = mappings.CANONICAL_TO_SERVICE
    SOURCE_TYPE_MAPPINGS = mappings.SOURCE_TYPE_MAPPINGS
  }
  return { CANONICAL_TO_SERVICE_FIELDS, SOURCE_TYPE_MAPPINGS }
}

class NodeDataSource {
  async fetchData(canonicalConfig) {
    const { CANONICAL_TO_SERVICE_FIELDS, SOURCE_TYPE_MAPPINGS } =
      await loadMappingsFromCore()

    // Mapear sourceType
    const apiType = SOURCE_TYPE_MAPPINGS.toApi[canonicalConfig.sourceType]

    // Mapear campos
    const serviceConfig = mapFields(
      canonicalConfig,
      CANONICAL_TO_SERVICE_FIELDS[canonicalConfig.sourceType]
    )

    // Chamar service
    return await this.callService(apiType, serviceConfig)
  }
}
```

## 📊 Exemplo: Executar Flow

**Request:**
```bash
POST /api/flows/507f1f77bcf86cd799439011/execute
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "inputData": {
    "url": "https://docs.google.com/spreadsheets/..."
  }
}
```

**Fluxo interno:**

1. **Controller** valida request e busca flow no MongoDB
2. **FlowExecutor** prepara contexto de execução
3. **NodeDataSourceFactory** carrega adapters usando mappings do Core
4. **Registry** carrega methods do Core via dynamic import
5. **Methods** executam usando `unwrapData` do Core
6. **Results** retornam para controller
7. **Response** enviada ao cliente

**Response:**
```json
{
  "success": true,
  "data": {
    "output": [
      { "name": "João", "value": 100 },
      { "name": "Maria", "value": 200 }
    ]
  },
  "executionTime": "1.2s",
  "nodesExecuted": 5
}
```

## 🔐 Autenticação

### JWT com Refresh Tokens

```javascript
// Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "senha123"
}

// Resposta
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",  // Expira em 1h
    "refreshToken": "eyJhbGc..." // Expira em 7d
  }
}

// Renovar token
POST /api/auth/refresh
{
  "refreshToken": "eyJhbGc..."
}
```

### OAuth com Google

```javascript
// 1. Redirecionar para Google
GET /api/auth/google

// 2. Google redireciona de volta
GET /api/auth/google/callback?code=xxx

// 3. API retorna tokens
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

## 🛡️ Segurança

- ✅ **Helmet**: Headers de segurança HTTP
- ✅ **CORS**: Configurado para frontend específico
- ✅ **Rate Limiting**: 100 req/15min por IP
- ✅ **JWT**: Tokens assinados com secrets
- ✅ **Bcrypt**: Passwords hasheados
- ✅ **Validação**: Joi schemas para todos os inputs
- ✅ **Sanitização**: Logs sem dados sensíveis

## 📈 Monitoramento

### Health Check

```bash
GET /health

# Resposta
{
  "status": "ok",
  "timestamp": "2024-10-11T15:30:00.000Z",
  "uptime": 3600,
  "mongodb": "connected",
  "version": "1.0.0"
}
```

### Logs

Logs estruturados com Winston:

```javascript
// Request log
{
  "level": "info",
  "message": "POST /api/flows/execute",
  "userId": "507f1f77bcf86cd799439011",
  "duration": "1200ms",
  "timestamp": "2024-10-11T15:30:00.000Z"
}

// Error log
{
  "level": "error",
  "message": "Erro ao executar flow",
  "error": "TypeError: Cannot read property...",
  "stack": "...",
  "timestamp": "2024-10-11T15:30:00.000Z"
}
```

## 📖 Swagger UI

Documentação interativa disponível em:

**http://localhost:3001/api/docs**

### Como usar:

1. Acesse a URL acima
2. Teste endpoint de login: `POST /api/auth/login`
3. Copie o `accessToken` da resposta
4. Clique em "Authorize" no topo
5. Cole o token
6. Teste outros endpoints autenticados

## 🔧 Desenvolvimento

### Scripts

```bash
pnpm dev           # Desenvolvimento com nodemon
pnpm start         # Produção
pnpm test          # Testes (quando implementados)
pnpm seed          # Popular DB com dados de teste
```

### Adicionar Novo Endpoint

1. **Criar route** em `routes/`
2. **Criar controller** em `controllers/`
3. **Criar service** (se necessário) em `services/`
4. **Registrar** em `app.js`

**Exemplo:**

```javascript
// routes/exampleRoutes.js
const express = require('express')
const router = express.Router()
const { getExample } = require('../controllers/exampleController')
const { authenticate } = require('../middleware/auth')

router.get('/', authenticate, getExample)

module.exports = router

// controllers/exampleController.js
async function getExample(req, res) {
  try {
    const result = await exampleService.doSomething()
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message }
    })
  }
}

// app.js
const exampleRoutes = require('./routes/exampleRoutes')
app.use('/api/example', exampleRoutes)
```

## 🐛 Troubleshooting

### Erro: "Cannot find module @flow-forge/core"

Certifique-se de que o Core está instalado:

```bash
cd ../core
pnpm install
pnpm link

cd ../api
pnpm link @flow-forge/core
```

### Erro: "import.meta.glob is not a function"

Methods do Core estão importando `executor.js` (problema browser). Devem usar `dataUtils.js`:

```javascript
// ❌ Errado
import { utils } from '../../engine/executor.js'
const { unwrapData } = utils

// ✅ Correto
import { unwrapData } from '../../utils/dataUtils.js'
```

### Erro: MongoDB connection failed

Certifique-se de que MongoDB está rodando:

```bash
# Linux/Mac
sudo systemctl start mongod

# Windows
net start MongoDB

# Docker
docker run -d -p 27017:27017 mongo:latest
```

## 📄 License

MIT

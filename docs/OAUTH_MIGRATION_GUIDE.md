# 🔄 Guia de Migração: OAuth Google Unificado

## 📋 O que mudou?

### Antes (DEPRECATED):
```javascript
// Rotas separadas para cada serviço
GET /api/oauth/google_analytics/authorize
GET /api/oauth/google_sheets/authorize

// Providers separados
provider: 'google_analytics'
provider: 'google_sheets'
```

### Agora (NOVO):
```javascript
// Rota unificada com scopes dinâmicos
GET /api/oauth/google/authorize?scopes=analytics,sheets&purpose=connection&serviceType=analytics

// Provider unificado
provider: 'google'
serviceType: 'analytics' | 'sheets' | 'drive' | 'gmail'
purpose: 'connection' | 'authentication'
```

---

## 🚀 Como usar o novo formato

### 1. Conectar Google Analytics
```javascript
GET /api/oauth/google/authorize?scopes=analytics&purpose=connection&serviceType=analytics
```

### 2. Conectar Google Sheets
```javascript
GET /api/oauth/google/authorize?scopes=sheets&purpose=connection&serviceType=sheets
```

### 3. Login Social (Sign in with Google)
```javascript
GET /api/auth/google/login
// ou
GET /api/oauth/google/authorize?scopes=profile&purpose=authentication
```

### 4. Múltiplos scopes (Analytics + Sheets)
```javascript
GET /api/oauth/google/authorize?scopes=analytics,sheets&purpose=connection&serviceType=analytics
```

---

## 🔧 Migração de Dados

### Executar Script de Migração
```bash
node scripts/migrate-google-connections.js
```

**O que faz:**
- Converte `google_analytics` → `{ provider: 'google', serviceType: 'analytics' }`
- Converte `google_sheets` → `{ provider: 'google', serviceType: 'sheets' }`
- Adiciona campo `purpose: 'connection'` em todas

### Estrutura do Model Connection (novo)
```javascript
{
  provider: 'google',           // Unificado
  serviceType: 'analytics',     // Diferenciação do serviço
  purpose: 'connection',        // connection ou authentication
  name: 'Google Analytics - user@email.com',
  // ... resto igual
}
```

---

## 📚 Retrocompatibilidade

As rotas antigas **ainda funcionam** mas mostram aviso de DEPRECATED:

```javascript
// ⚠️ DEPRECATED (mas ainda funciona)
GET /api/oauth/google_analytics/authorize
GET /api/oauth/google_sheets/authorize
```

**Recomendação:** Migre para o novo formato o quanto antes.

---

## 🔑 Variáveis de Ambiente

### Antes:
```bash
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google/callback
GOOGLE_SHEETS_REDIRECT_URI=http://localhost:3001/api/oauth/google_sheets/callback
```

### Agora (simplificado):
```bash
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google/callback
# Uma única URL de callback!
```

---

## 🎯 Exemplos Práticos

### Frontend - Conectar Google Analytics
```javascript
async function connectGoogleAnalytics() {
  const response = await fetch('/api/oauth/google/authorize?scopes=analytics&purpose=connection&serviceType=analytics', {
    headers: { Authorization: `Bearer ${userToken}` }
  });

  const { data } = await response.json();

  // Redirecionar usuário para Google
  window.location.href = data.authUrl;
}
```

### Frontend - Login com Google
```javascript
async function loginWithGoogle() {
  const response = await fetch('/api/auth/google/login');
  const { data } = await response.json();

  // Redirecionar usuário para Google
  window.location.href = data.authUrl;
}

// Callback (após autorização)
// URL: /auth/callback?success=true&token=JWT_TOKEN&email=user@gmail.com
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// Salvar token e fazer login
localStorage.setItem('accessToken', token);
```

### Usar conexão no conector (por ID)
```javascript
// Continua funcionando igual
const gaData = await connectorAdapter.fetch({
  propertyId: '123456789',
  connectionId: '507f1f77bcf86cd799439011', // ID do MongoDB
  metrics: ['sessions'],
  dimensions: ['date']
}, resolvedDates, userId);
```

### Usar conexão no conector (por serviceType) - NOVO!
```javascript
// Agora você pode usar serviceType ao invés de ID
const gaData = await connectorAdapter.fetch({
  propertyId: '123456789',
  connectionId: 'analytics', // ou 'google_analytics'
  metrics: ['sessions'],
  dimensions: ['date']
}, resolvedDates, userId);

// Sistema busca automaticamente a conexão Google Analytics do usuário
```

---

## 🧪 Testes

### 1. Testar conexão Google Analytics
```bash
# Gerar URL
curl -X GET "http://localhost:3001/api/oauth/google/authorize?scopes=analytics&purpose=connection&serviceType=analytics" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Abrir URL no navegador
# Autorizar
# Verificar redirect para /connections?success=true
```

### 2. Testar login social
```bash
# Gerar URL
curl -X GET "http://localhost:3001/api/auth/google/login"

# Abrir URL no navegador
# Autorizar
# Verificar redirect para /auth/callback?token=JWT_TOKEN
```

---

## ❓ FAQ

### Por que unificar?
- **1 redirect URI** no Google Cloud Console ao invés de múltiplos
- **Reutilização** do código OAuth para login social
- **Flexibilidade** para adicionar Drive, Gmail, Calendar facilmente
- **Escalável** para outros providers (Facebook, GitHub)

### As conexões antigas ainda funcionam?
Sim! Execute o script de migração e tudo continuará funcionando normalmente.

### Preciso reautorizar usuários?
Não! A migração preserva todos os tokens. Usuários não precisam autorizar novamente.

### Como adicionar Google Drive?
```javascript
// 1. Adicionar scope preset no oauthService.js (já existe)
// 2. Criar conexão
GET /api/oauth/google/authorize?scopes=drive&purpose=connection&serviceType=drive

// 3. Usar no adapter
connectionId: 'drive' // ou ID do MongoDB
```

---

## 📞 Suporte

Problemas ou dúvidas? Abra uma issue no repositório.

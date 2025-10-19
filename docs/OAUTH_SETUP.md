# OAuth Setup Guide - Flow Forge API

## 🎯 Visão Geral

O Flow Forge agora suporta **OAuth 2.0** para conectar com Google Analytics (GA4) de forma simples e segura, sem precisar de Service Accounts JSON.

## 📋 Pré-requisitos

1. Conta Google Cloud Platform
2. Projeto criado no GCP
3. Google Analytics 4 property configurada

## 🔧 Configuração Google Cloud

### 1. Criar Projeto no Google Cloud Console

Acesse: https://console.cloud.google.com

```
1. Clique em "Select a project" → "New Project"
2. Nome: "Flow Forge API"
3. Clique em "Create"
```

### 2. Habilitar APIs Necessárias

```
1. No menu lateral: APIs & Services → Library
2. Busque e habilite:
   - Google Analytics Data API
   - Google Analytics API (opcional, para v3)
```

### 3. Configurar OAuth Consent Screen

```
1. APIs & Services → OAuth consent screen
2. User Type: External (ou Internal se G Workspace)
3. Preencha:
   - App name: Flow Forge
   - User support email: seu@email.com
   - Developer contact: seu@email.com
4. Scopes: Adicionar:
   - .../auth/analytics.readonly
   - .../auth/analytics
5. Test users (modo desenvolvimento): Adicione seu email
6. Salve
```

### 4. Criar Credenciais OAuth 2.0

```
1. APIs & Services → Credentials
2. Create Credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Name: Flow Forge API
5. Authorized redirect URIs:
   - http://localhost:3001/api/oauth/google_analytics/callback
   - https://sua-api.com/api/oauth/google_analytics/callback (produção)
6. Clique em "Create"
7. COPIE: Client ID e Client Secret
```

## ⚙️ Configuração Backend

### 1. Adicionar ao .env

```bash
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123xyz
GOOGLE_REDIRECT_URI=http://localhost:3001/api/oauth/google_analytics/callback
FRONTEND_URL=http://localhost:3000

# Encryption (gere uma chave de 32 bytes)
ENCRYPTION_KEY=your_32_byte_key_here_1234567890
```

### 2. Gerar ENCRYPTION_KEY

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Uso da API

### Fluxo Completo

#### 1. Frontend: Iniciar OAuth

```javascript
// Frontend (React/Vue/etc)
const initiateGoogleAuth = async () => {
  const response = await fetch('/api/oauth/google_analytics/authorize', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });

  const { data } = await response.json();

  // Abrir popup ou redirecionar
  window.location.href = data.authUrl;
};
```

#### 2. Google: Usuário autoriza

O Google vai:
- Mostrar tela de consentimento
- Usuário clica "Permitir"
- Redireciona para: `/api/oauth/google_analytics/callback?code=...`

#### 3. Backend: Callback processa automaticamente

O backend automaticamente:
- Troca `code` por `access_token` e `refresh_token`
- Criptografa tokens
- Salva no MongoDB (model Connection)
- Redireciona para: `${FRONTEND_URL}/connections?success=true`

#### 4. Frontend: Lista conexões

```javascript
const getConnections = async () => {
  const response = await fetch('/api/oauth/connections', {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });

  const { data } = await response.json();
  return data.connections;
};

// Response:
[
  {
    "_id": "65a1b2c3d4e5f6789...",
    "provider": "google_analytics",
    "name": "Google Analytics - user@gmail.com",
    "isActive": true,
    "expiresAt": "2025-01-15T10:30:00Z",
    "providerData": {
      "email": "user@gmail.com",
      "name": "John Doe"
    }
  }
]
```

#### 5. Usar conexão para buscar dados

```javascript
const fetchAnalyticsData = async (connectionId) => {
  const response = await fetch('/api/connectors/execute', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sourceType: 'analytics',
      config: {
        connectionId: connectionId, // ← USA OAUTH
        propertyId: '123456789'
      },
      temporalConfig: {
        enabled: true,
        rangeType: 'relative',
        relativeRange: 'last_30_days'
      }
    })
  });

  return await response.json();
};
```

## 🔄 Refresh Token Automático

O sistema **renova automaticamente** tokens expirados:

```javascript
// Isso acontece automaticamente dentro de getValidAccessToken()
// Você não precisa fazer nada!

// Se quiser forçar refresh manualmente:
POST /api/oauth/connections/{connectionId}/refresh
```

## 🧪 Testar Conexão

```javascript
POST /api/oauth/connections/{connectionId}/test

// Response:
{
  "success": true,
  "data": {
    "status": "active",
    "message": "Conexão funcionando corretamente"
  }
}
```

## 🗑️ Revogar Conexão

```javascript
DELETE /api/oauth/connections/{connectionId}

// Isso vai:
// 1. Revogar token no Google
// 2. Marcar conexão como inativa
// 3. Remover do banco
```

## 📊 Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/oauth/{provider}/authorize` | Inicia fluxo OAuth |
| GET | `/api/oauth/{provider}/callback` | Callback (automático) |
| GET | `/api/oauth/connections` | Lista conexões |
| GET | `/api/oauth/connections/{id}` | Detalhes da conexão |
| POST | `/api/oauth/connections/{id}/refresh` | Renovar token |
| POST | `/api/oauth/connections/{id}/test` | Testar conexão |
| DELETE | `/api/oauth/connections/{id}` | Revogar conexão |

## 🔒 Segurança

### Tokens são Criptografados

```javascript
// Model Connection usa AES-256-CBC
accessToken: "iv:encryptedToken" // Criptografado no banco
refreshToken: "iv:encryptedToken" // Criptografado no banco

// Descriptografa apenas quando necessário
const token = connection.decryptedAccessToken; // Virtual getter
```

### State Parameter

Protege contra CSRF:

```javascript
state = base64({
  userId: "65a1b2c...",
  timestamp: 1705320000000,
  custom: "frontend_data"
})
```

### Auto-desativação

Após 5 erros consecutivos, conexão é desativada automaticamente.

## 🐛 Troubleshooting

### Erro: "redirect_uri_mismatch"

```
Solução: Adicione exatamente a mesma URI no Google Cloud Console
Exemplo: http://localhost:3001/api/oauth/google_analytics/callback
```

### Erro: "invalid_client"

```
Solução: Verifique GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env
```

### Erro: "Token inválido"

```
Solução: Delete a conexão e reconecte (tokens podem expirar após 7 dias sem uso)
```

### Erro: "access_denied"

```
Usuário clicou em "Negar" no Google.
Solução: Tente novamente e clique em "Permitir"
```

## 🌐 Produção

### 1. Atualizar Redirect URI

```
Google Cloud Console:
- Adicionar: https://api.seudominio.com/api/oauth/google_analytics/callback
```

### 2. Atualizar .env

```bash
GOOGLE_REDIRECT_URI=https://api.seudominio.com/api/oauth/google_analytics/callback
FRONTEND_URL=https://app.seudominio.com
NODE_ENV=production
```

### 3. OAuth Consent Screen

Mude de "Testing" para "In production" no Google Cloud Console.

## 📚 Recursos

- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

## 🎉 Pronto!

Agora seus usuários podem conectar Google Analytics com **2 cliques**, sem precisar baixar JSON ou copiar credenciais! 🚀
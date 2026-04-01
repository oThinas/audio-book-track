# Auth API Contracts

**Feature**: 001-login-auth  
**Date**: 2026-03-31  
**Base path**: `/api/auth`

> Rotas gerenciadas pelo better-auth via catch-all route handler (`app/api/auth/[...all]/route.ts`).
> Os contratos abaixo documentam o comportamento esperado para esta feature.

---

## POST /api/auth/sign-in/username

Autentica um usuário por username e senha.

### Request

```json
{
  "username": "joao_silva",
  "password": "senha123"
}
```

### Validação (Zod — client-side antes do envio)

- `username`: string, alfanumérico + underscore, 3-30 caracteres (`/^[a-zA-Z0-9_]{3,30}$/`)
- `password`: string, mínimo 6 caracteres

### Response — Sucesso (200)

```json
{
  "user": {
    "id": "cuid_xxx",
    "name": "João Silva",
    "username": "joao_silva",
    "email": "joao@example.com",
    "createdAt": "2026-03-31T00:00:00.000Z",
    "updatedAt": "2026-03-31T00:00:00.000Z"
  },
  "session": {
    "id": "session_xxx",
    "token": "token_xxx",
    "expiresAt": "2026-04-07T00:00:00.000Z"
  }
}
```

Headers de resposta incluem `Set-Cookie` com token de sessão (httpOnly, secure, sameSite=lax, maxAge=604800).

### Response — Erro (401)

```json
{
  "error": {
    "message": "Invalid credentials",
    "status": 401
  }
}
```

**Importante**: A mensagem de erro é genérica — não indica se o username não existe ou se a senha está incorreta (FR-008).

### Response — Rate Limited (429)

```json
{
  "error": {
    "message": "Too many requests. Please try again later.",
    "status": 429
  }
}
```

Ativado após 3 tentativas em 1 minuto. Bloqueio de 5 minutos (FR-009).

---

## POST /api/auth/sign-out

Encerra a sessão do usuário autenticado.

### Request

Sem body. Autenticação via cookie de sessão.

### Response — Sucesso (200)

```json
{
  "success": true
}
```

Headers de resposta limpam o cookie de sessão.

### Response — Erro (401)

```json
{
  "error": {
    "message": "Unauthorized",
    "status": 401
  }
}
```

---

## GET /api/auth/get-session

Retorna os dados da sessão atual (usado internamente para verificar autenticação).

### Request

Sem body. Autenticação via cookie de sessão.

### Response — Sucesso (200)

```json
{
  "user": {
    "id": "cuid_xxx",
    "name": "João Silva",
    "username": "joao_silva",
    "email": "joao@example.com"
  },
  "session": {
    "id": "session_xxx",
    "expiresAt": "2026-04-07T00:00:00.000Z"
  }
}
```

### Response — Não autenticado (401)

```json
{
  "error": {
    "message": "Unauthorized",
    "status": 401
  }
}
```

---

## Rotas bloqueadas

As seguintes rotas do better-auth são desabilitadas via configuração (`emailAndPassword.disableSignUp: true`):

- `POST /api/auth/sign-up/email` → Retorna erro (sign-up desabilitado)
- `POST /api/auth/sign-up/username` → Retorna erro (sign-up desabilitado)
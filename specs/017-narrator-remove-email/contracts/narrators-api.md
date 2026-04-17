# Contract: `/api/v1/narrators` após remoção do e-mail

**Feature**: 017-narrator-remove-email
**Date**: 2026-04-17
**Status**: Delta em relação ao contrato existente de `015-narrators-crud`

Este documento descreve apenas as diferenças. Rotas, autenticação (sessão via better-auth), headers (`Cache-Control: no-store`), envelopes (`{ data }` / `{ error: { code, message, details } }`), e status codes **não listados abaixo** permanecem idênticos ao contrato anterior.

---

## `GET /api/v1/narrators`

### Resposta 200

**Antes**:
```json
{
  "data": [
    { "id": "uuid", "name": "Ana Paula", "email": "ana@example.com", "createdAt": "...", "updatedAt": "..." }
  ]
}
```

**Depois**:
```json
{
  "data": [
    { "id": "uuid", "name": "Ana Paula", "createdAt": "...", "updatedAt": "..." }
  ]
}
```

- Campo `email` **removido** do objeto.

---

## `POST /api/v1/narrators`

### Request body

**Antes** (validado por `createNarratorSchema`):
```json
{ "name": "Ana Paula", "email": "ana@example.com" }
```

**Depois**:
```json
{ "name": "Ana Paula" }
```

- Schema Zod deixa de reconhecer `email`. Qualquer chave extra é descartada silenciosamente (comportamento padrão do Zod — não usar `.strict()`).
- `name`: `string`, trim, 2–100 chars (inalterado).

### Resposta 201

**Antes**:
```json
{ "data": { "id": "uuid", "name": "Ana Paula", "email": "ana@example.com", "createdAt": "...", "updatedAt": "..." } }
```

**Depois**:
```json
{ "data": { "id": "uuid", "name": "Ana Paula", "createdAt": "...", "updatedAt": "..." } }
```

- `Location` header permanece: `/api/v1/narrators/{id}`.

### Status codes

| Código | Condição | Mudança |
|--------|----------|---------|
| 201    | Criado com sucesso | — |
| 401    | Sem sessão | — |
| 422    | `name` ausente, muito curto ou muito longo | — |
| **409** | **Nome já cadastrado** (`NAME_ALREADY_IN_USE`) | Era `EMAIL_ALREADY_IN_USE` — agora aplica-se a `name` |

#### Exemplo de resposta `409`

```json
{
  "error": {
    "code": "NAME_ALREADY_IN_USE",
    "message": "Nome já cadastrado"
  }
}
```

---

## `PATCH /api/v1/narrators/:id`

### Request body

**Antes** (validado por `updateNarratorSchema`, partial):
```json
{ "name": "Ana P.", "email": "nova@example.com" }
```

**Depois**:
```json
{ "name": "Ana P." }
```

- Todos os campos são opcionais (partial). Payload vazio `{}` é válido — no-op (permanece assim).
- Qualquer `email` enviado é descartado silenciosamente.

### Resposta 200

Mesmo envelope do GET, sem campo `email`.

### Status codes

| Código | Condição | Mudança |
|--------|----------|---------|
| 200    | Atualizado com sucesso | — |
| 401    | Sem sessão | — |
| 404    | Narrador não encontrado | — |
| 422    | `name` inválido | — |
| **409** | **Nome já cadastrado em outro narrador** (`NAME_ALREADY_IN_USE`) | Era `EMAIL_ALREADY_IN_USE` — agora aplica-se a `name` |

#### Comportamento de idempotência no PATCH

Renomear um narrador para o **mesmo nome que ele já tem** (após `trim`) NÃO retorna `409` — a constraint única compara contra outras linhas, não contra a linha sendo atualizada. O `UPDATE` do PostgreSQL é tratado corretamente nesse caso.

---

## `DELETE /api/v1/narrators/:id`

Sem mudanças. Status `204`, `401`, `404` preservados.

---

## Códigos de erro — mudanças

| Código de erro | Situação anterior | Status após feature |
|----------------|-------------------|---------------------|
| `EMAIL_ALREADY_IN_USE` | Retornado em `409` de POST/PATCH quando `email` duplicado | **Descontinuado** — não é mais emitido |
| `NAME_ALREADY_IN_USE` | — | **Novo** — retornado em `409` de POST/PATCH quando `name` duplicado (após `trim`, case-sensitive) |

O `409` continua sendo um estado válido tratado pelo handler da API; apenas o `code` do envelope de erro muda. Consumidores (UI React Hook Form) DEVEM atualizar o mapeamento de `code → setError("name", { message: "Nome já cadastrado" })`.

---

## Auth/Headers

- `auth.api.getSession` continua sendo o gate de autenticação.
- `Cache-Control: no-store` continua em todas as respostas.
- CORS/CSRF: sem mudanças.

## Observabilidade

- Sem logs novos ou removidos.
- Métricas: nenhuma exposta especificamente para narradores.

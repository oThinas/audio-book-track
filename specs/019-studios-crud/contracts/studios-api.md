# Contract: `/api/v1/studios`

**Feature**: 019-studios-crud
**Date**: 2026-04-21
**Status**: Novo contrato — tabela `studio` e rotas inexistentes hoje

Autenticação via better-auth (`auth.api.getSession`). Sessão inválida ⇒ `401`. Cache sempre `Cache-Control: no-store`. Envelope: `{ data }` em sucesso, `{ error: { code, message, details? } }` em erro.

Valores monetários (`defaultHourlyRate`) sempre trafegam como **`number` em reais** (ex: `85`, `85.5`, `9999.99`) — nunca string, nunca centavos. O cliente web usa `MoneyInput` (cents-first UX) que publica `number`; a API valida com Zod a faixa `0.01 ≤ x ≤ 9999.99` e no máximo 2 casas decimais.

---

## `GET /api/v1/studios`

Lista todos os estúdios ordenados por `createdAt` **ascendente** (ordem cronológica natural). A inversão para `DESC` (mais recente no topo) é responsabilidade do consumidor web — ver [research.md §R5](../research.md).

### Resposta `200`

```json
{
  "data": [
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "name": "Sonora Studio",
      "defaultHourlyRate": 85,
      "createdAt": "2026-04-21T14:30:00.000Z",
      "updatedAt": "2026-04-21T14:30:00.000Z"
    },
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000002",
      "name": "Estúdio Voz & Arte",
      "defaultHourlyRate": 90,
      "createdAt": "2026-04-21T15:00:00.000Z",
      "updatedAt": "2026-04-21T15:00:00.000Z"
    }
  ]
}
```

### Status codes

| Código | Condição |
|--------|----------|
| 200    | Sucesso (array pode ser vazio) |
| 401    | Sem sessão |

---

## `POST /api/v1/studios`

Cria um novo estúdio.

### Request body

```json
{ "name": "Sonora Studio", "defaultHourlyRate": 85 }
```

### Validação (`createStudioSchema`)

| Campo | Regra |
|---|---|
| `name` | string, `trim`, 2–100 caracteres, obrigatório |
| `defaultHourlyRate` | number, `0.01 ≤ x ≤ 9999.99`, máximo 2 casas decimais, obrigatório |

### Resposta `201`

**Headers**: `Location: /api/v1/studios/<id>`

```json
{
  "data": {
    "id": "a1b2c3d4-0000-0000-0000-000000000003",
    "name": "Sonora Studio",
    "defaultHourlyRate": 85,
    "createdAt": "2026-04-21T15:45:00.000Z",
    "updatedAt": "2026-04-21T15:45:00.000Z"
  }
}
```

### Erro `409` — conflito de nome

```json
{
  "error": {
    "code": "NAME_ALREADY_IN_USE",
    "message": "Nome já cadastrado"
  }
}
```

### Erro `422` — validação Zod

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "path": ["defaultHourlyRate"], "message": "Valor/hora máximo é R$ 9.999,99" }
    ]
  }
}
```

### Status codes

| Código | Condição |
|--------|----------|
| 201    | Estúdio criado com sucesso |
| 401    | Sem sessão |
| 409    | Nome já cadastrado (`NAME_ALREADY_IN_USE`) |
| 422    | Payload inválido (Zod) |

---

## `PATCH /api/v1/studios/:id`

Atualiza nome e/ou `defaultHourlyRate` de um estúdio existente. Campos ausentes no body não são alterados.

### Request body (exemplos)

Apenas o nome:
```json
{ "name": "Sonora Studio Plus" }
```

Apenas o valor/hora:
```json
{ "defaultHourlyRate": 100 }
```

Ambos:
```json
{ "name": "Sonora Studio Plus", "defaultHourlyRate": 100 }
```

### Validação (`updateStudioSchema` = `studioFormSchema.partial()`)

Cada campo presente segue as mesmas regras de `createStudioSchema`. Body vazio `{}` é aceito (idempotente — equivale a um `GET` do recurso).

### Resposta `200`

```json
{
  "data": {
    "id": "a1b2c3d4-0000-0000-0000-000000000003",
    "name": "Sonora Studio Plus",
    "defaultHourlyRate": 100,
    "createdAt": "2026-04-21T15:45:00.000Z",
    "updatedAt": "2026-04-21T16:00:00.000Z"
  }
}
```

### Erro `404`

```json
{
  "error": { "code": "NOT_FOUND", "message": "Estúdio não encontrado" }
}
```

### Erro `409` / `422`

Mesmos formatos de `POST`.

### Status codes

| Código | Condição |
|--------|----------|
| 200    | Estúdio atualizado |
| 401    | Sem sessão |
| 404    | Estúdio não encontrado (`NOT_FOUND`) |
| 409    | Nome já cadastrado (`NAME_ALREADY_IN_USE`) |
| 422    | Payload inválido |

**Idempotência**: `PATCH` com valores idênticos aos atuais retorna `200` sem falso positivo de conflito (o `WHERE id = ?` não toca a unicidade do próprio registro).

---

## `DELETE /api/v1/studios/:id`

Remove um estúdio.

### Resposta `204`

Sem body.

### Erro `404`

```json
{
  "error": { "code": "NOT_FOUND", "message": "Estúdio não encontrado" }
}
```

### Status codes

| Código | Condição |
|--------|----------|
| 204    | Estúdio removido |
| 401    | Sem sessão |
| 404    | Estúdio não encontrado |

**Nota**: não há constraint de exclusão com livros ainda (livros referenciarão estúdio apenas em feature futura). Exclusão é sempre livre.

---

## Envelope de erro — referência

```typescript
interface ApiErrorEnvelope {
  error: {
    code: "NAME_ALREADY_IN_USE" | "NOT_FOUND" | "VALIDATION_ERROR" | "UNAUTHORIZED";
    message: string;
    details?: Array<{ path: Array<string | number>; message: string }>;
  };
}
```

---

## Security & headers

- **Autenticação obrigatória**: todas as rotas checam sessão via `auth.api.getSession({ headers: req.headers })`. Sem sessão ⇒ `401 { error: { code: "UNAUTHORIZED", message: "Não autenticado" } }`.
- **Cache**: todas as respostas (inclusive `GET`) usam `Cache-Control: no-store` — dados mutáveis.
- **Stack traces / SQL messages**: NUNCA expostos no envelope de erro. Erros não mapeados ⇒ `500 { error: { code: "INTERNAL_ERROR", message: "Erro interno" } }` + log estruturado server-side.
- **CSRF**: same-origin com cookies `SameSite=Lax` (herdado da configuração better-auth existente).

# Contract: `/api/v1/editors`

**Feature**: 018-editors-crud
**Date**: 2026-04-17
**Status**: Novo contrato — tabela e rotas inexistentes hoje

Autenticação via better-auth (`auth.api.getSession`). Sessão inválida ⇒ `401`. Cache sempre `Cache-Control: no-store`. Envelope: `{ data }` em sucesso, `{ error: { code, message, details? } }` em erro.

---

## `GET /api/v1/editors`

Lista todos os editores ordenados por `createdAt` ascendente (mesmo padrão de Narrador).

### Resposta `200`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Carla Mendes",
      "email": "carla@studio.com",
      "createdAt": "2026-04-17T00:00:00.000Z",
      "updatedAt": "2026-04-17T00:00:00.000Z"
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

## `POST /api/v1/editors`

Cria um novo editor.

### Request body

```json
{ "name": "Carla Mendes", "email": "carla@studio.com" }
```

Validação Zod (`createEditorSchema`):

- `name`: `string`, `trim`, 2–100 chars.
- `email`: `string`, `trim`, 1–255 chars, formato e-mail (`.email()`).
- Chaves extras são descartadas silenciosamente (Zod default; consistente com pattern de Narrador).

O service aplica `email.trim().toLowerCase()` antes de persistir. `name` preserva a capitalização original (após trim).

### Resposta `201`

```json
{
  "data": {
    "id": "uuid",
    "name": "Carla Mendes",
    "email": "carla@studio.com",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

Headers: `Location: /api/v1/editors/{id}`, `Cache-Control: no-store`.

### Status codes

| Código | Condição |
|--------|----------|
| 201    | Criado com sucesso |
| 401    | Sem sessão |
| 422    | `name` ausente/inválido, `email` ausente/inválido, ou ambos (`details` lista os campos) |
| 409    | `name` ou `email` já cadastrado |

#### Exemplo de resposta `422`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "path": "email", "message": "E-mail inválido" }
    ]
  }
}
```

#### Exemplo de resposta `409` — nome duplicado

```json
{
  "error": {
    "code": "NAME_ALREADY_IN_USE",
    "message": "Nome já cadastrado"
  }
}
```

#### Exemplo de resposta `409` — e-mail duplicado

```json
{
  "error": {
    "code": "EMAIL_ALREADY_IN_USE",
    "message": "E-mail já cadastrado"
  }
}
```

---

## `PATCH /api/v1/editors/:id`

Atualiza parcialmente um editor.

### Request body

```json
{ "name": "Carla Mendes Silva" }
```
ou
```json
{ "email": "carla.silva@studio.com" }
```
ou ambos. Payload vazio `{}` é aceito e é no-op (consistente com `updateNarratorSchema.partial()`).

Validação Zod (`updateEditorSchema` = `editorFormSchema.partial()`):

- `name`: opcional; se presente, 2–100 chars após trim.
- `email`: opcional; se presente, formato válido, ≤255 chars.
- O service normaliza os campos presentes (`trim`/`toLowerCase` conforme regra) antes de persistir.

### Resposta `200`

Mesmo envelope do GET, com o objeto atualizado.

### Status codes

| Código | Condição |
|--------|----------|
| 200    | Atualizado |
| 401    | Sem sessão |
| 404    | Editor não encontrado |
| 422    | Body malformado ou campo inválido |
| 409    | `name` duplicado em outro editor (`NAME_ALREADY_IN_USE`) |
| 409    | `email` duplicado em outro editor (`EMAIL_ALREADY_IN_USE`) |

### Idempotência

Renomear/re-emailar um editor para **o mesmo valor** que ele já tem (após trim/lowercase) **não** retorna `409` — o `UPDATE` do PostgreSQL contra a própria linha não viola o índice único. Também se aplica ao caso em que apenas a capitalização do email muda (`Carla@Studio.com` → `carla@studio.com` normaliza para o mesmo valor).

---

## `DELETE /api/v1/editors/:id`

Exclui o editor. Nenhuma FK entrante nesta feature ⇒ exclusão sempre livre.

### Resposta `204`

Sem body. Header `Cache-Control: no-store`.

### Status codes

| Código | Condição |
|--------|----------|
| 204    | Excluído |
| 401    | Sem sessão |
| 404    | Editor não encontrado |

---

## Códigos de erro emitidos por esta API

| Código               | Endpoint(s)       | Condição |
|----------------------|-------------------|----------|
| `UNAUTHORIZED`       | Todos             | Sessão ausente ou inválida |
| `VALIDATION_ERROR`   | POST, PATCH       | Payload falha no schema Zod |
| `EDITOR_NOT_FOUND`   | PATCH, DELETE     | `id` não existe no banco |
| `NAME_ALREADY_IN_USE`| POST, PATCH       | `name` duplicado (após trim) |
| `EMAIL_ALREADY_IN_USE`| POST, PATCH      | `email` duplicado (após trim+lowercase) |

Todos seguem o envelope `{ error: { code, message, details? } }` dos helpers de `src/lib/api/responses.ts`.

---

## Auth / Headers / Observabilidade

- `auth.api.getSession({ headers })` é chamado em todo handler antes de qualquer lógica. Retorno `null` ⇒ `401`.
- `Cache-Control: no-store` em todas as respostas (inclusive `204`).
- Nenhum CORS/CSRF específico — a mesma configuração global se aplica.
- Nenhum log novo. Stack traces e mensagens de SQL NUNCA aparecem nas respostas — o `catch` do handler mapeia para os códigos acima.

# API Contracts — Narrators

Todas as rotas exigem sessão autenticada (better-auth). Sem sessão → `401`.

Base URL: `/api/v1/narrators`

---

## GET `/api/v1/narrators`

Lista todos os narradores cadastrados. Sem paginação (volume pequeno, conforme SC).

### Request

- Headers: `Cookie: <sessão better-auth>`

### Response 200

```json
{
  "data": [
    {
      "id": "e7f1a9b0-1234-4abc-9def-1234567890ab",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "createdAt": "2026-04-10T12:00:00.000Z",
      "updatedAt": "2026-04-10T12:00:00.000Z"
    }
  ]
}
```

Ordenação: `createdAt ASC` (ordem estável — sort visual é client-side).

### Response 401

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Sessão inválida ou expirada"
  }
}
```

---

## POST `/api/v1/narrators`

Cria um novo narrador.

### Request

- Headers: `Content-Type: application/json`, `Cookie: <sessão>`
- Body:

```json
{
  "name": "João Silva",
  "email": "joao@exemplo.com"
}
```

### Response 201

- Headers: `Location: /api/v1/narrators/<id>`
- Body:

```json
{
  "data": {
    "id": "e7f1a9b0-1234-4abc-9def-1234567890ab",
    "name": "João Silva",
    "email": "joao@exemplo.com",
    "createdAt": "2026-04-16T15:30:00.000Z",
    "updatedAt": "2026-04-16T15:30:00.000Z"
  }
}
```

### Response 422 (validação Zod)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      { "path": ["email"], "message": "E-mail inválido" }
    ]
  }
}
```

### Response 409 (e-mail duplicado)

```json
{
  "error": {
    "code": "EMAIL_ALREADY_IN_USE",
    "message": "E-mail já cadastrado"
  }
}
```

---

## PATCH `/api/v1/narrators/:id`

Atualiza parcialmente um narrador. Ambos os campos são opcionais.

### Request

- Headers: `Content-Type: application/json`, `Cookie: <sessão>`
- Path: `id` (UUID)
- Body (exemplo com ambos os campos):

```json
{
  "name": "João Santos",
  "email": "joao.santos@exemplo.com"
}
```

Body pode conter apenas um dos campos.

### Response 200

```json
{
  "data": {
    "id": "e7f1a9b0-1234-4abc-9def-1234567890ab",
    "name": "João Santos",
    "email": "joao.santos@exemplo.com",
    "createdAt": "2026-04-10T12:00:00.000Z",
    "updatedAt": "2026-04-16T15:31:00.000Z"
  }
}
```

### Response 404

```json
{
  "error": {
    "code": "NARRATOR_NOT_FOUND",
    "message": "Narrador não encontrado"
  }
}
```

### Response 422

Mesmo formato do POST.

### Response 409

Mesmo formato do POST (e-mail duplicado).

---

## DELETE `/api/v1/narrators/:id`

Exclui um narrador.

### Request

- Headers: `Cookie: <sessão>`
- Path: `id` (UUID)

### Response 204

Sem body.

### Response 404

```json
{
  "error": {
    "code": "NARRATOR_NOT_FOUND",
    "message": "Narrador não encontrado"
  }
}
```

### Response 409 (DIFERIDO — implementar quando CRUD de Capítulos existir)

Narrador vinculado a capítulos cujo livro está em status ativo (pendente, em edição, em revisão, edição retake):

```json
{
  "error": {
    "code": "NARRATOR_HAS_ACTIVE_CHAPTERS",
    "message": "Narrador vinculado a capítulos em andamento não pode ser excluído"
  }
}
```

Narradores vinculados apenas a capítulos de livros concluído/pago são excluídos normalmente (204).

---

## Error Code Reference

| HTTP | Code | Quando |
|------|------|--------|
| 401 | `UNAUTHORIZED` | Sem sessão válida |
| 404 | `NARRATOR_NOT_FOUND` | `id` não existe |
| 409 | `EMAIL_ALREADY_IN_USE` | E-mail duplicado |
| 409 | `NARRATOR_HAS_ACTIVE_CHAPTERS` | Vinculado a capítulos em andamento (diferido) |
| 422 | `VALIDATION_ERROR` | Zod falhou; `details` contém `path` + `message` por erro |

---

## Contract Test Coverage (referência)

| Endpoint | Cenários cobertos | Tipo de teste |
|----------|-------------------|---------------|
| `GET /api/v1/narrators` | sem auth (401), com auth (200 + shape), lista vazia (200 + `{ data: [] }`) | Unit (route handler) + E2E |
| `POST /api/v1/narrators` | sem auth (401), body inválido (422), e-mail duplicado (409), sucesso (201 + Location) | Unit + Integration + E2E |
| `PATCH /api/v1/narrators/:id` | sem auth (401), id inexistente (404), body inválido (422), duplicata (409), sucesso parcial (200) | Unit + Integration + E2E |
| `DELETE /api/v1/narrators/:id` | sem auth (401), id inexistente (404), sucesso (204) | Unit + Integration + E2E |

# API Contract Delta: `/api/v1/editors`

**Feature**: 020-books-chapters-crud
**Stage**: Phase 1

Simétrico a `narrators-delta.md`, adaptado a editores.

---

## `GET /api/v1/editors`

Filtra `WHERE deleted_at IS NULL`. Adiciona campo `chaptersCount`:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Bruno Gomes",
      "email": "bruno@example.com",
      "chaptersCount": 7,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

`chaptersCount` = `SELECT COUNT(*) FROM chapter WHERE editor_id = editor.id`.

---

## `POST /api/v1/editors`

Desarquive automático quando o `name` colide com editor soft-deleted:

- Comparação por `lower(name)` (case-insensitive).
- `email` continua único **globalmente** (ativo OU soft-deleted) — o índice `editor_email_unique` não muda.

### Response `200 OK` (reativação)

```json
{
  "data": { ... },
  "meta": { "reactivated": true }
}
```

### Response `201 Created` (criação normal)

```json
{
  "data": { ... },
  "meta": { "reactivated": false }
}
```

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Zod falhou. |
| `NAME_ALREADY_IN_USE` | 409 | Colisão com editor **ativo** (mesmo `lower(name)`). |
| `EMAIL_ALREADY_IN_USE` | 409 | `email` colide com editor ativo **ou** soft-deleted (auditabilidade). |

---

## `DELETE /api/v1/editors/:id`

Soft-delete. Pré-condição (simétrica a narrador):

```sql
SELECT COUNT(*) FROM chapter c
JOIN book b ON b.id = c.book_id
WHERE c.editor_id = :id
AND EXISTS (
  SELECT 1 FROM chapter c2
  WHERE c2.book_id = b.id
  AND c2.status IN ('pending', 'editing', 'reviewing', 'retake')
);
```

Se `> 0` ⇒ `409 EDITOR_LINKED_TO_ACTIVE_CHAPTERS`.

### Response `204 No Content`

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Editor não existe ou já soft-deleted. |
| `EDITOR_LINKED_TO_ACTIVE_CHAPTERS` | 409 | Pré-condição violada. |

---

## `PATCH /api/v1/editors/:id`

Bloqueia updates em registros soft-deleted (404 NOT_FOUND).

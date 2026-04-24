# API Contract Delta: `/api/v1/narrators`

**Feature**: 020-books-chapters-crud
**Stage**: Phase 1

Mesma estrutura de mudanças que `studios-delta.md`, adaptada a narradores.

---

## `GET /api/v1/narrators`

Filtra `WHERE deleted_at IS NULL`. Adiciona campo `chaptersCount`:

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Ana Silva",
      "chaptersCount": 12,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

`chaptersCount` = `SELECT COUNT(*) FROM chapter WHERE narrator_id = narrator.id`.

---

## `POST /api/v1/narrators`

Desarquive automático quando o `name` colide com narrador soft-deleted:

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
| `NAME_ALREADY_IN_USE` | 409 | Colisão com narrador **ativo**. |

---

## `DELETE /api/v1/narrators/:id`

Soft-delete. Pré-condição:

```sql
SELECT COUNT(*) FROM chapter c
JOIN book b ON b.id = c.book_id
WHERE c.narrator_id = :id
AND EXISTS (
  SELECT 1 FROM chapter c2
  WHERE c2.book_id = b.id
  AND c2.status IN ('pendente', 'em_edicao', 'em_revisao', 'edicao_retake')
);
```

Se `> 0` ⇒ `409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS`.

### Response `204 No Content`

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Narrador não existe ou já soft-deleted. |
| `NARRATOR_LINKED_TO_ACTIVE_CHAPTERS` | 409 | Pré-condição violada. |

---

## `PATCH /api/v1/narrators/:id`

Bloqueia updates em registros soft-deleted (404 NOT_FOUND).

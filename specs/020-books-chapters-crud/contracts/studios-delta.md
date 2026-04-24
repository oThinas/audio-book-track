# API Contract Delta: `/api/v1/studios`

**Feature**: 020-books-chapters-crud
**Stage**: Phase 1
**Delta sobre**: contrato existente em `specs/019-studios-crud/contracts/studios.md`

Nenhum endpoint novo; mudanças aditivas no comportamento de `POST`, `DELETE` e `GET` para suportar soft-delete, desarquive automático e a nova coluna derivada "Livros".

---

## Alteração em `GET /api/v1/studios`

Listagem filtra `WHERE deleted_at IS NULL`.

### Response `200 OK` — novo campo `booksCount`

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Sonora Studio",
      "defaultHourlyRate": "75.00",
      "booksCount": 3,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

`booksCount` é calculado server-side via `LEFT JOIN book GROUP BY studio.id`. Estúdios com `deleted_at IS NOT NULL` nem aparecem.

---

## Alteração em `POST /api/v1/studios`

Comportamento original: cria novo estúdio.
Novo: se o `name` colidir com um estúdio soft-deleted existente, **reativa** o registro (seta `deleted_at = NULL`) em vez de retornar 409.

### Response `200 OK` (reativação)

```json
{
  "data": {
    "id": "uuid-do-registro-original",
    "name": "Sonora Studio",
    "defaultHourlyRate": "75.00",  // preservado do registro original
    "createdAt": "2025-12-15T10:00:00.000Z",  // original
    "updatedAt": "2026-04-23T11:00:00.000Z"   // atualizado na reativação
  },
  "meta": { "reactivated": true }
}
```

### Response `201 Created` (criação normal — sem colisão)

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
| `NAME_ALREADY_IN_USE` | 409 | Nome colide com **estúdio ativo** (não soft-deleted). |

### Integração com modal de livro (US3/FR-012)

Quando `POST /studios` é chamado a partir do subformulário inline no modal de livro, o client passa `{ name, defaultHourlyRate: "0.01" }`. Se for reativação e o fluxo for o inline-no-modal, o `default_hourly_rate` do registro reativado é **sobrescrito** para `0.01` — a regra é aplicada apenas quando o client explicita `inline: true` no payload:

```json
POST /api/v1/studios
{ "name": "Sonora Studio", "defaultHourlyRate": "0.01", "inline": true }
```

`inline: true` no payload sinaliza que a reativação deve sobrescrever `default_hourly_rate` (em vez de preservar) e que o `meta.rateResetForInline: true` deve ser adicionado à resposta — o client usa isso para exibir o toast extra explicando a redefinição.

---

## Alteração em `DELETE /api/v1/studios/:id`

Comportamento original: remove o estúdio.
Novo: soft-delete (`UPDATE studio SET deleted_at = now() WHERE id = :id`).

### Pré-condição `FR-046`

```sql
SELECT COUNT(*) FROM book b
JOIN chapter c ON c.book_id = b.id
WHERE b.studio_id = :id
AND c.status IN ('pendente', 'em_edicao', 'em_revisao', 'edicao_retake');
```

Se `> 0` ⇒ `409 STUDIO_HAS_ACTIVE_BOOKS` com detalhes sobre quantos livros/capítulos estão bloqueando.

### Response `204 No Content` (soft-delete aceito)

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Estúdio não existe ou já está soft-deleted. |
| `STUDIO_HAS_ACTIVE_BOOKS` | 409 | Pré-condição violada. |

---

## Alteração em `PATCH /api/v1/studios/:id`

Bloquear update em estúdios com `deleted_at IS NOT NULL`: `404 NOT_FOUND`. Forçar o produtor a reativar primeiro (via re-criação pelo nome no modal).

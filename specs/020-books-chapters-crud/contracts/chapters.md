# API Contract: `/api/v1/chapters`

**Feature**: 020-books-chapters-crud
**Stage**: Phase 1

Endpoints para mutação individual de capítulos. Leitura de capítulos acontece embutida em `GET /api/v1/books/:id` — não há `GET /chapters`.

---

## `PATCH /api/v1/chapters/:id`

Atualiza status, narrador, editor ou horas editadas de um capítulo. Aplica a máquina de estados (FR-025) e dispara `recomputeBookStatus(book_id)`.

### Request body (todos opcionais; ao menos 1 presente)

```json
{
  "status": "editing",
  "narratorId": "uuid-ou-null",
  "editorId": "uuid-ou-null",
  "editedHours": "2.50",
  "confirmReversion": true
}
```

### Zod

```ts
z.object({
  status: z.enum(["pending", "editing", "reviewing", "retake", "completed", "paid"]).optional(),
  narratorId: z.string().uuid().nullable().optional(),
  editorId: z.string().uuid().nullable().optional(),
  editedHours: z.string().regex(/^\d+(\.\d{1,2})?$/)
    .refine(v => Number(v) >= 0 && Number(v) <= 999.99).optional(),
  confirmReversion: z.boolean().optional(),
})
.refine(data => Object.keys(data).length > 0, { message: "Pelo menos um campo deve ser fornecido" });
```

### Validações semânticas no service

Estado atual do capítulo determina validações:

1. Se `currentStatus === 'paid'`:
   - Qualquer campo não-`status` presente ⇒ `409 CHAPTER_PAID_LOCKED`.
   - `status` presente:
     - Se `status !== 'completed'` ⇒ `422 INVALID_STATUS_TRANSITION`.
     - Se `status === 'completed'` e `confirmReversion !== true` ⇒ `422 REVERSION_CONFIRMATION_REQUIRED`.
     - Se `status === 'completed'` e `confirmReversion === true` ⇒ aceita.

2. Se `currentStatus !== 'paid'`:
   - `status` transição validada via `isValidTransition(current, target, { narratorId, editorId, editedHours })`:
     - `pending → editing`: exige `narratorId` não-null (pós-merge com payload).
     - `editing → reviewing`: exige `editorId` não-null e `editedHours > 0`.
     - `reviewing → retake`, `retake → reviewing`, `reviewing → completed`, `completed → paid`: permitidas sem pré-condições extras.
     - Outras: `422 INVALID_STATUS_TRANSITION`.
   - Campos diretos (`narratorId`, `editorId`, `editedHours`) atualizam livremente quando `status` não muda.

### Response `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "bookId": "uuid",
    "number": 1,
    "status": "editing",
    "narrator": { "id": "uuid", "name": "Ana Silva" },
    "editor": null,
    "editedHours": "0.00",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "meta": { "bookStatus": "editing" }
}
```

`meta.bookStatus` informa o novo `book.status` recomputado, economizando round-trip para o client atualizar o cabeçalho do livro.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Zod falhou. |
| `NOT_FOUND` | 404 | Capítulo não existe. |
| `INVALID_STATUS_TRANSITION` | 422 | Transição não permitida pela FSM. |
| `NARRATOR_REQUIRED` | 422 | `pending → editing` sem narrador. |
| `EDITOR_OR_HOURS_REQUIRED` | 422 | `editing → reviewing` sem editor ou horas=0. |
| `REVERSION_CONFIRMATION_REQUIRED` | 422 | `paid → completed` sem `confirmReversion: true`. |
| `CHAPTER_PAID_LOCKED` | 409 | Tentou alterar narrador/editor/horas em capítulo `paid`. |
| `NARRATOR_NOT_FOUND` | 422 | `narratorId` inexistente ou soft-deleted. |
| `EDITOR_NOT_FOUND` | 422 | `editorId` inexistente ou soft-deleted. |

### Side effects transacionais

1. `UPDATE chapter SET ... WHERE id = :id` (com guards acima).
2. `recomputeBookStatus(chapter.book_id, tx)`.
3. Se reversão `paid → completed` e nenhum outro capítulo `paid` sobra, `book.price_per_hour` passa a ser editável (UI descobre via `GET` subsequente — nenhuma operação explícita aqui).

---

## `DELETE /api/v1/chapters/:id`

Exclui um capítulo. Se for o último não-`paid` e não houver `paid`, cascata para deletar o livro.

### Response `204 No Content`

Header `X-Book-Deleted: true` quando o livro foi removido como efeito.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Capítulo não existe. |
| `CHAPTER_PAID_LOCKED` | 409 | Capítulo em status `paid`. |

### Side effects transacionais

1. Valida ownership + status.
2. `DELETE FROM chapter WHERE id = :id`.
3. `SELECT COUNT(*) FROM chapter WHERE book_id = :bookId`.
4. Se count = 0: `DELETE FROM book WHERE id = :bookId` + header `X-Book-Deleted: true`. Caso contrário, `recomputeBookStatus(bookId, tx)`.

---

## Nota sobre `GET`

Não há `GET /api/v1/chapters` nem `GET /api/v1/chapters/:id` no MVP. Toda leitura de capítulos acontece via `GET /api/v1/books/:id` (capítulos embutidos). Introduzir GETs avulsos é YAGNI (Princípio IV) — nenhuma story P1/P2/P3 precisa disso.

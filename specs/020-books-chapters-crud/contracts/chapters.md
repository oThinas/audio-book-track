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
  "status": "em_edicao",
  "narratorId": "uuid-ou-null",
  "editorId": "uuid-ou-null",
  "horasEditadas": "2.50",
  "confirmReversion": true
}
```

### Zod

```ts
z.object({
  status: z.enum(["pendente","em_edicao","em_revisao","edicao_retake","concluido","pago"]).optional(),
  narratorId: z.string().uuid().nullable().optional(),
  editorId: z.string().uuid().nullable().optional(),
  horasEditadas: z.string().regex(/^\d+(\.\d{1,2})?$/)
    .refine(v => Number(v) >= 0 && Number(v) <= 999.99).optional(),
  confirmReversion: z.boolean().optional(),
})
.refine(data => Object.keys(data).length > 0, { message: "Pelo menos um campo deve ser fornecido" });
```

### Validações semânticas no service

Estado atual do capítulo determina validações:

1. Se `currentStatus === 'pago'`:
   - Qualquer campo não-`status` presente ⇒ `409 CHAPTER_PAID_LOCKED`.
   - `status` presente:
     - Se `status !== 'concluido'` ⇒ `422 INVALID_STATUS_TRANSITION`.
     - Se `status === 'concluido'` e `confirmReversion !== true` ⇒ `422 REVERSION_CONFIRMATION_REQUIRED`.
     - Se `status === 'concluido'` e `confirmReversion === true` ⇒ aceita.

2. Se `currentStatus !== 'pago'`:
   - `status` transição validada via `isValidTransition(current, target, { narratorId, editorId, horasEditadas })`:
     - `pendente → em_edicao`: exige `narratorId` não-null (pós-merge com payload).
     - `em_edicao → em_revisao`: exige `editorId` não-null e `horasEditadas > 0`.
     - `em_revisao → edicao_retake`, `edicao_retake → em_revisao`, `em_revisao → concluido`, `concluido → pago`: permitidas sem pré-condições extras.
     - Outras: `422 INVALID_STATUS_TRANSITION`.
   - Campos diretos (`narratorId`, `editorId`, `horasEditadas`) atualizam livremente quando `status` não muda.

### Response `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "bookId": "uuid",
    "numero": 1,
    "status": "em_edicao",
    "narrator": { "id": "uuid", "name": "Ana Silva" },
    "editor": null,
    "horasEditadas": "0.00",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "meta": { "bookStatus": "em_edicao" }
}
```

`meta.bookStatus` informa o novo `book.status` recomputado, economizando round-trip para o client atualizar o cabeçalho do livro.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Zod falhou. |
| `NOT_FOUND` | 404 | Capítulo não existe. |
| `INVALID_STATUS_TRANSITION` | 422 | Transição não permitida pela FSM. |
| `NARRATOR_REQUIRED` | 422 | `pendente → em_edicao` sem narrador. |
| `EDITOR_OR_HOURS_REQUIRED` | 422 | `em_edicao → em_revisao` sem editor ou horas=0. |
| `REVERSION_CONFIRMATION_REQUIRED` | 422 | `pago → concluido` sem `confirmReversion: true`. |
| `CHAPTER_PAID_LOCKED` | 409 | Tentou alterar narrador/editor/horas em capítulo `pago`. |
| `NARRATOR_NOT_FOUND` | 422 | `narratorId` inexistente ou soft-deleted. |
| `EDITOR_NOT_FOUND` | 422 | `editorId` inexistente ou soft-deleted. |

### Side effects transacionais

1. `UPDATE chapter SET ... WHERE id = :id` (com guards acima).
2. `recomputeBookStatus(chapter.book_id, tx)`.
3. Se reversão `pago → concluido` e nenhum outro capítulo `pago` sobra, `book.price_per_hour` passa a ser editável (UI descobre via `GET` subsequente — nenhuma operação explícita aqui).

---

## `DELETE /api/v1/chapters/:id`

Exclui um capítulo. Se for o último não-pago e não houver `pago`, cascata para deletar o livro.

### Response `204 No Content`

Header `X-Book-Deleted: true` quando o livro foi removido como efeito.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Capítulo não existe. |
| `CHAPTER_PAID_LOCKED` | 409 | Capítulo em status `pago`. |

### Side effects transacionais

1. Valida ownership + status.
2. `DELETE FROM chapter WHERE id = :id`.
3. `SELECT COUNT(*) FROM chapter WHERE book_id = :bookId`.
4. Se count = 0: `DELETE FROM book WHERE id = :bookId` + header `X-Book-Deleted: true`. Caso contrário, `recomputeBookStatus(bookId, tx)`.

---

## Nota sobre `GET`

Não há `GET /api/v1/chapters` nem `GET /api/v1/chapters/:id` no MVP. Toda leitura de capítulos acontece via `GET /api/v1/books/:id` (capítulos embutidos). Introduzir GETs avulsos é YAGNI (Princípio IV) — nenhuma story P1/P2/P3 precisa disso.

# Contract: PUT /api/v1/books/:bookId/chapters/order

**Type**: HTTP endpoint (novo)
**Feature**: 026-chapter-titles-reordering

## Purpose

Persiste atomicamente uma nova ordem para os capítulos do livro `:bookId`. Substitui posições `0..N-1` pelos IDs na ordem informada.

## Request

```http
PUT /api/v1/books/{bookId}/chapters/order
Content-Type: application/json
```

```jsonc
{
  "orderedIds": [
    "ch-uuid-3",
    "ch-uuid-1",
    "ch-uuid-2"
  ],
  "expectedVersion": 7
}
```

### Body schema (Zod — ver data-model.md § reorderChaptersSchema)

- `orderedIds`: array de UUIDs, sem duplicatas, comprimento ≥ 1. **DEVE conter exatamente o conjunto de IDs dos capítulos do livro** (validação no service).
- `expectedVersion`: `book.chapters_version` conhecido pelo cliente.

## Response — 200 OK

```jsonc
{
  "data": {
    "chaptersVersion": 8
  }
}
```

Resposta enxuta — o cliente já aplicou a nova ordem otimisticamente.

## Errors

| Status | Code | Quando |
|--------|------|--------|
| 400 | `INVALID_JSON` | Body não-parsável. |
| 404 | `BOOK_NOT_FOUND` | `bookId` não existe. |
| 422 | `CHAPTERS_ORDER_MISMATCH` | `orderedIds` não bate com IDs atuais (faltam, sobram ou IDs estranhos). |
| 409 | `BOOK_CHAPTERS_VERSION_CONFLICT` | `expectedVersion` ≠ atual. |

## Side effects

- Transação única com `BEGIN ... COMMIT`:
  1. `SELECT` atual: IDs e `chapters_version` do livro com `FOR UPDATE` no `book`.
  2. Compara `expectedVersion`.
  3. Compara conjunto de IDs com `orderedIds`.
  4. `UPDATE chapter SET position = $1 WHERE id = $2 AND book_id = $3` para cada par. Constraint unique DEFERRABLE permite a permutação sem violação intermediária.
  5. `recomputeBookStatusAndBumpVersion(bookId, tx)` — atualiza `book.chapters_version` (também recomputa `status`, embora reorder normalmente não o altere).
- Nenhum outro campo do capítulo é tocado.

## Auth

Sessão válida obrigatória. Mesma política dos outros endpoints `/api/v1/books/*`.

## Client usage (referência)

Consumido em `src/components/features/chapters/hooks/use-chapters-reorder.ts`. Cliente:

1. Aplica nova ordem otimisticamente no estado local (renderiza imediatamente).
2. Chama `apiFetch<ReorderResponse>(...)`.
3. Em sucesso, atualiza `chaptersVersion` em cache local.
4. Em erro (409 ou outro), reverte para a ordem anterior, e `apiFetch` dispara toast com a mensagem do catálogo.

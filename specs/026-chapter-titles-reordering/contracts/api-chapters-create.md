# Contract: POST /api/v1/books/:bookId/chapters

**Type**: HTTP endpoint (novo)
**Feature**: 026-chapter-titles-reordering

## Purpose

Cria um capítulo no livro `:bookId` na posição indicada. Cobre os três casos da feature: capítulo numerado (`title = "Capítulo N"`), capítulo via template (`title = "Prólogo" | "Epílogo" | "Apresentação"`) e capítulo personalizado (`title = <texto livre>`). O servidor não distingue origem; recebe apenas o `title` final.

## Request

```http
POST /api/v1/books/{bookId}/chapters
Content-Type: application/json
```

```jsonc
{
  "title": "Prólogo",
  "position": "start",                       // ou "end"  ou { "after": "<chapter-uuid>" }
  "expectedVersion": 7                       // book.chapters_version conhecido pelo cliente
}
```

### Path params

| Param | Tipo | Descrição |
|-------|------|-----------|
| `bookId` | UUID v4 | ID do livro. |

### Body schema (Zod — ver data-model.md § createChapterSchema)

- `title`: 1..100 chars, trim no servidor, sem `\n`/`\r`.
- `position`:
  - `"start"` → novo capítulo na `position = 0`; demais empurrados em +1.
  - `"end"` → novo capítulo em `position = max+1`.
  - `{ after: <uuid> }` → novo capítulo na posição `(target.position + 1)`; demais ≥ inseridas empurrados em +1.
- `expectedVersion`: inteiro não-negativo, igual a `book.chapters_version` corrente.

## Response — 201 Created

```jsonc
{
  "data": {
    "chapter": {
      "id": "…",
      "bookId": "…",
      "title": "Prólogo",
      "position": 0,
      "status": "pending",
      "narratorId": null,
      "editorId": null,
      "editedSeconds": 0,
      "deadline": null,
      "createdAt": "2026-05-15T13:42:11Z",
      "updatedAt": "2026-05-15T13:42:11Z"
    },
    "bookStatus": "pending",
    "chaptersVersion": 8
  }
}
```

## Errors

Todos via `withApiErrorHandler` → envelope padrão `{ error: { code, message } }`.

| Status | Code | Quando |
|--------|------|--------|
| 400 | `INVALID_JSON` | Body não-parsável. |
| 404 | `BOOK_NOT_FOUND` | `bookId` não existe. |
| 422 | `CHAPTER_TITLE_INVALID` | Título vazio, > 100 chars, com `\n`/`\r`. |
| 422 | `CHAPTER_POSITION_TARGET_INVALID` | `position.after` aponta para capítulo que não pertence ao livro. |
| 409 | `BOOK_CHAPTERS_VERSION_CONFLICT` | `expectedVersion` ≠ atual. |

## Side effects

- Transação única: INSERT do novo capítulo + UPDATE em batch dos demais (empurrar positions ≥ alvo em +1) + `BookStatusRecomputeService` recomputa `book.status` e bumpa `book.chapters_version`.
- Invariante "positions densas 0..N-1" mantida.

## Auth

Sessão válida obrigatória (mesma da rota PATCH atual `/api/v1/chapters/:id`). Sem permissão extra além de admin (modelo de roles do projeto).

## Client usage (referência)

Consumido em `src/components/features/chapters/hooks/use-add-chapter.ts` via `apiFetch<CreateChapterResponse>(...)`. Em conflito 409, hook dispara toast (`apiFetch` já trata) e o componente fecha o dialog após recarregar a lista.

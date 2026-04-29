# API Contract: `/api/v1/books`

**Feature**: 020-books-chapters-crud
**Stage**: Phase 1

Todos os endpoints exigem sessão autenticada (better-auth). Request/response em JSON. Envelope `{ data }` em sucesso e `{ error: { code, message, details? } }` em erro. Validação de input via Zod.

---

## `GET /api/v1/books`

Lista todos os livros do produtor autenticado com contagens e ganho total já agregados.

### Request

Sem body. Sem query params no MVP.

### Response `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Dom Casmurro",
      "studio": { "id": "uuid", "name": "Sonora Studio" },
      "pricePerHourCents": 7500,
      "pdfUrl": null,
      "status": "editing",
      "totalChapters": 10,
      "completedChapters": 3,
      "totalEarningsCents": 45000,
      "createdAt": "2026-04-20T12:00:00.000Z",
      "updatedAt": "2026-04-23T08:30:00.000Z"
    }
  ]
}
```

Ordenação: por `created_at DESC`. Filtragem e ordenação adicionais são client-side (A6).

---

## `POST /api/v1/books`

Cria um novo livro com N capítulos em `pending`. Suporta propagação transacional de `price_per_hour_cents` para um estúdio criado inline.

### Request body

```json
{
  "title": "Dom Casmurro",
  "studioId": "uuid-do-estudio",
  "pricePerHourCents": 7500,
  "numChapters": 10,
  "inlineStudioId": "uuid-do-estudio-criado-inline"  // OPCIONAL
}
```

### Zod schema (resumo)

```ts
z.object({
  title: z.string().trim().min(1).max(255),
  studioId: z.string().uuid(),
  pricePerHourCents: z.number().int().min(1).max(999_999),
  numChapters: z.number().int().min(1).max(999),
  inlineStudioId: z.string().uuid().optional(),
})
.refine((data) => data.inlineStudioId === undefined || data.inlineStudioId === data.studioId, {
  message: "inlineStudioId must match studioId when provided",
});
```

`pricePerHourCents` é **integer** (centavos). A UI converte `"75.00"` digitado no formulário via `Math.round(value * 100)` antes de enviar.

### Response `201 Created` + `Location: /api/v1/books/:id`

```json
{
  "data": {
    "id": "uuid",
    "title": "Dom Casmurro",
    "studioId": "uuid",
    "pricePerHourCents": 7500,
    "pdfUrl": null,
    "status": "pending",
    "createdAt": "2026-04-23T09:00:00.000Z",
    "updatedAt": "2026-04-23T09:00:00.000Z",
    "chapters": [
      { "id": "uuid", "number": 1, "status": "pending", ... },
      { "id": "uuid", "number": 2, "status": "pending", ... }
    ]
  }
}
```

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Input falhou Zod. |
| `STUDIO_NOT_FOUND` | 422 | `studioId` não existe ou está soft-deleted. |
| `INLINE_STUDIO_INVALID` | 422 | `inlineStudioId` não existe, não tem `default_hourly_rate_cents = 1`, ou usuário autenticado não é owner. |
| `TITLE_ALREADY_IN_USE` | 409 | Já existe livro com mesmo `lower(title)` no `studioId`. |
| `UNAUTHORIZED` | 401 | Sem sessão. |

### Side effects transacionais

1. `INSERT INTO book`.
2. Gera `numChapters` linhas em `chapter` com `number = 1..N`, todas `pending`.
3. Se `inlineStudioId` presente e válido: `UPDATE studio SET default_hourly_rate_cents = :pricePerHourCents WHERE id = :inlineStudioId`.
4. `recomputeBookStatus(book.id, tx)` → cache do `book.status` = `pending`.

Falha em qualquer etapa ⇒ rollback total. O estúdio criado via fluxo anterior de FR-012 **não** é revertido — ele persiste com `default_hourly_rate_cents = 1` (FR-014).

---

## `GET /api/v1/books/:id`

Retorna o livro com capítulos embutidos e o estúdio resolvido.

### Response `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "title": "Dom Casmurro",
    "studio": { "id": "uuid", "name": "Sonora Studio" },
    "pricePerHourCents": 7500,
    "pdfUrl": "https://example.com/book.pdf",
    "status": "editing",
    "totalChapters": 10,
    "completedChapters": 3,
    "totalEarningsCents": 45000,
    "createdAt": "...",
    "updatedAt": "...",
    "chapters": [
      {
        "id": "uuid",
        "number": 1,
        "status": "completed",
        "narrator": { "id": "uuid", "name": "Ana Silva" },
        "editor": { "id": "uuid", "name": "Bruno Gomes" },
        "editedSeconds": 9000,
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | `id` não existe. |
| `UNAUTHORIZED` | 401 | Sem sessão. |

Observação: o estúdio embutido pode estar soft-deleted (para exibir nome em livros históricos).

---

## `PATCH /api/v1/books/:id`

Edita título/estúdio/valor-hora/quantidade de capítulos. Aumentar capítulos cria novos na mesma transação; **reduzir é proibido**.

### Request body (todos os campos opcionais, no mínimo 1 presente)

```json
{
  "title": "Dom Casmurro (2ª edição)",
  "studioId": "uuid-diferente",
  "pricePerHourCents": 8500,
  "numChapters": 12
}
```

### Zod validações específicas

- `numChapters` — se presente, deve ser `>= currentTotalChapters`. Se menor, erro `CANNOT_REDUCE_CHAPTERS`.
- `pricePerHourCents` — bloqueado se existe algum capítulo `paid`. Erro `BOOK_PAID_PRICE_LOCKED`.
- `studioId` — bloqueado se existe capítulo `paid`. Erro `BOOK_PAID_STUDIO_LOCKED`.

### Response `200 OK`

Mesma forma de `GET /books/:id` atualizada.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Zod falhou. |
| `NOT_FOUND` | 404 | Livro não existe. |
| `TITLE_ALREADY_IN_USE` | 409 | Novo título colide no estúdio. |
| `CANNOT_REDUCE_CHAPTERS` | 422 | `numChapters < total atual`. |
| `BOOK_PAID_PRICE_LOCKED` | 409 | Tentou alterar `pricePerHourCents` com capítulo `paid`. |
| `BOOK_PAID_STUDIO_LOCKED` | 409 | Tentou alterar `studioId` com capítulo `paid`. |
| `STUDIO_NOT_FOUND` | 422 | Novo `studioId` não existe ou está soft-deleted. |

### Side effects transacionais (quando `numChapters > current`)

1. `UPDATE book SET ... WHERE id = :id`.
2. `delta = numChapters - current`; cria `delta` novos capítulos com `number = MAX(number) + 1 ... + delta`, status `pending`.
3. `recomputeBookStatus(book.id, tx)`.

---

## `DELETE /api/v1/books/:id`

Remove o livro e cascata em capítulos (via FK `ON DELETE CASCADE`). UI não expõe essa rota diretamente no MVP — é usada pelo service de cascade quando o último capítulo é removido (FR-028, FR-033).

### Response `204 No Content`

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `NOT_FOUND` | 404 | Livro não existe. |
| `BOOK_HAS_PAID_CHAPTERS` | 409 | Livro ainda tem capítulos `paid` (proteção extra — normalmente a UI nunca dispara DELETE quando há capítulos `paid`, mas o backend recusa). |

---

## `POST /api/v1/books/:id/chapters/bulk-delete`

Exclui atomicamente múltiplos capítulos. Se todos os capítulos não-`paid` forem removidos e não sobrar capítulo `paid`, o livro é removido também.

### Request body

```json
{ "chapterIds": ["uuid", "uuid", "uuid"] }
```

### Zod

```ts
z.object({ chapterIds: z.array(z.string().uuid()).min(1).max(999) });
```

### Response `204 No Content`

Header `X-Book-Deleted: true` quando o livro foi removido como efeito.

### Erros

| Code | Status | Quando |
|------|--------|--------|
| `VALIDATION_ERROR` | 422 | Lista vazia ou malformada. |
| `NOT_FOUND` | 404 | Livro não existe. |
| `CHAPTERS_NOT_IN_BOOK` | 422 | Algum `chapterId` não pertence ao `book_id`. |
| `CHAPTER_PAID_LOCKED` | 409 | Algum dos IDs está em status `paid` (atomic — nada é excluído). |

### Side effects transacionais

1. Valida ownership (capítulos pertencem ao `book_id`).
2. Valida nenhum é `paid`.
3. `DELETE FROM chapter WHERE id = ANY(...)`.
4. Conta capítulos remanescentes: se `0`, `DELETE FROM book WHERE id = :bookId` e seta header `X-Book-Deleted: true`.
5. Se livro persiste, `recomputeBookStatus(book.id, tx)`.

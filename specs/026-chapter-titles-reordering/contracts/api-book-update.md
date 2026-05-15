# Contract: PATCH /api/v1/books/:id  (mudança)

**Type**: HTTP endpoint (existente — mudança)
**Feature**: 026-chapter-titles-reordering

## Purpose

Atualiza atributos do livro. **Mudança nesta feature**: remove o campo `numChapters` (que aumentava capítulos numerados via PATCH). Toda criação de capítulo passa pelo `POST /books/:bookId/chapters` (ver contrato dedicado).

## Request

```http
PATCH /api/v1/books/{id}
Content-Type: application/json
```

```jsonc
{
  "title": "Novo título",
  "studioId": "…",
  "pricePerHourCents": 13000,
  "pdfUrl": "https://…"
}
```

### Mudanças

- ❌ Campo `numChapters` removido. Tentativa de enviar resulta em erro de validação Zod (extra key rejeitada pelo strict mode do schema).
- Demais campos (`title`, `studioId`, `pricePerHourCents`, `pdfUrl`, `inlineStudioId`) inalterados — mesma semântica.

## Response — 200 OK

Sem mudança no envelope. `chaptersVersion` não é tocado por PATCH de livro (não há mutação de capítulo aqui).

## Errors

Sem códigos novos. Comportamento existente preservado:
- `BOOK_NOT_FOUND` (404)
- `BOOK_TITLE_DUPLICATE` (422)
- `BOOK_PAID_PRICE_LOCKED` (409)
- `BOOK_PAID_STUDIO_LOCKED` (409)
- `STUDIO_REFERENCE_INVALID` (422)
- `BOOK_INLINE_STUDIO_INVALID` (422)

## UI impact

- `book-edit-dialog.tsx` remove o componente `<ChapterCountInput>` e o `data-testid="book-edit-chapters-reduce-hint"`.
- Hook `use-edit-book-form.ts` deixa de validar e enviar `numChapters`.
- Testes E2E que dependiam do incremento via edição precisam migrar para o novo fluxo (`+ Adicionar capítulo` na página de detalhe).

## Backward compatibility

Breaking para clientes que enviavam `numChapters`. Mesma observação do contrato de POST /books: único consumidor é o frontend deste projeto.

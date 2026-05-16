# Contract: PATCH /api/v1/chapters/:id  (extensão)

**Type**: HTTP endpoint (existente — extensão)
**Feature**: 026-chapter-titles-reordering

## Purpose

Atualiza um capítulo individual. Esta feature **adiciona o campo `title`** ao schema e à lista `PAID_LOCKED_FIELDS`. `position` NÃO é editável por aqui — usar `PUT /chapters/order`.

## Request

```http
PATCH /api/v1/chapters/{id}
Content-Type: application/json
```

```jsonc
{
  "title": "Abertura",                       // <-- NOVO
  "status": "reviewing",
  "narratorId": "…",
  "editorId": "…",
  "editedSeconds": 1200,
  "deadline": "2026-06-30",
  "confirmReversion": false
}
```

Todos os campos opcionais; pelo menos um deve ser enviado.

### Mudanças nesta feature

- **Novo**: campo `title` aceita string 1..100 chars, trim no servidor, rejeita `\n`/`\r`. Se ausente, capítulo mantém título atual.
- **`PAID_LOCKED_FIELDS` agora inclui `title`**. Tentativa de alterar `title` em capítulo `paid` retorna 409 `CHAPTER_PAID_LOCKED`.

## Response — 200 OK

```jsonc
{
  "data": {
    "chapter": { /* …Chapter completo, com title atualizado… */ },
    "bookStatus": "reviewing",
    "chaptersVersion": 9                     // <-- NOVO no envelope
  }
}
```

`chaptersVersion` passa a ser sempre incluído (afeta clientes que precisem mantê-lo em cache).

## Errors (novos / alterados)

| Status | Code | Mudança |
|--------|------|---------|
| 422 | `CHAPTER_TITLE_INVALID` | **Novo**. Título vazio, > 100 chars, ou com `\n`/`\r`. |
| 409 | `CHAPTER_PAID_LOCKED` | **Mensagem alterada** para incluir "título" — ver R-010 da research. |

Demais códigos do endpoint atual (`CHAPTER_NOT_FOUND`, `CHAPTER_INVALID_TRANSITION`, `CHAPTER_NARRATOR_REQUIRED`, etc.) inalterados.

## Side effects

- Mutação envolvida em transação que bumpa `book.chapters_version` (via `recomputeBookStatusAndBumpVersion`).
- Update de `title` não toca `position` nem qualquer outro campo do capítulo.

## Backward compatibility

- Clientes antigos que enviavam payload sem `title` continuam funcionando — `title` é opcional.
- Clientes antigos que **não conhecem** `chaptersVersion` no envelope simplesmente ignoram o campo extra (envelope é compatível).

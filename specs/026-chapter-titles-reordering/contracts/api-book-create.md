# Contract: POST /api/v1/books  (extensão)

**Type**: HTTP endpoint (existente — extensão)
**Feature**: 026-chapter-titles-reordering

## Purpose

Cria livro. **Mudança nesta feature**: o campo `numChapters` (inteiro) é substituído por `chapters: { numbered, extras }` para suportar criação atômica com capítulos numerados + extras (templates ou personalizados) em qualquer posição.

## Request

```http
POST /api/v1/books
Content-Type: application/json
```

```jsonc
{
  "title": "Diário de uma viagem",
  "studioId": "…",
  "inlineStudioId": null,
  "pricePerHourCents": 12000,
  "chapters": {
    "numbered": 10,
    "extras": [
      { "kind": "template", "template": "prologue", "position": "start" },
      { "kind": "template", "template": "epilogue", "position": "end" },
      { "kind": "custom", "title": "Nota do tradutor", "position": "start" }
    ]
  }
}
```

### Body schema (Zod — ver data-model.md § createBookSchema)

- `title`: string trim, ≥ 1 char.
- `studioId`: UUID.
- `inlineStudioId`: UUID opcional (para criação inline de estúdio — comportamento existente preservado).
- `pricePerHourCents`: inteiro 1..999999.
- `chapters.numbered`: inteiro 0..NUM_CHAPTERS_MAX.
- `chapters.extras`: array de até 20 itens, cada um:
  - `kind: "template"`: `template ∈ { prologue | epilogue | presentation }`, `position ∈ { start | end }`.
  - `kind: "custom"`: `title` (1..100 chars, trim, sem newline), `position ∈ { start | end }`.
- **Constraint global**: `numbered > 0 || extras.length > 0`.

### Comportamento de inserção

- Capítulos numerados nascem com `title = "Capítulo 1".."Capítulo N"` e `position = (extras com position=start).length + offset`.
- Cada extra com `position: "start"` é inserido no início (ordem entre extras `start` mantida conforme aparecem no array).
- Cada extra com `position: "end"` é inserido no fim (ordem mantida).
- Resultado final: positions densas `0..(numbered + extras.length - 1)`.

**Exemplo.** `numbered=3`, `extras=[start:Prólogo, end:Epílogo, start:Nota]`:

```
position 0: "Nota do tradutor"   (extra start, segundo na lista)
position 1: "Prólogo"            (extra start, primeiro na lista)
position 2: "Capítulo 1"
position 3: "Capítulo 2"
position 4: "Capítulo 3"
position 5: "Epílogo"
```

*(Detalhe da ordem entre múltiplos `start`: extras `start` são inseridos na **ordem em que aparecem no array**, o último vira `position 0`. Spec define que UI permita reordenar a lista de extras antes de submeter, mantendo o array contract estável.)*

## Response — 201 Created

```jsonc
{
  "data": {
    "book": { /* …Book completo, incluindo chaptersVersion=0… */ },
    "chapters": [ /* lista de Chapter na ordem por position ASC */ ]
  }
}
```

## Errors

| Status | Code | Quando |
|--------|------|--------|
| 422 | `BOOK_TITLE_DUPLICATE` (existente) | Título duplicado no estúdio. |
| 422 | `STUDIO_REFERENCE_INVALID` (existente) | Estúdio inválido. |
| 422 | `CHAPTER_TITLE_INVALID` | Extra `custom` com título vazio/longo/com newline. |
| 422 | `BOOK_CHAPTERS_EMPTY` (novo opcional, ou via Zod generic) | `numbered + extras.length == 0`. |

## Side effects

- Transação única: cria livro (`chapters_version=0`), insere todos os capítulos com positions calculadas, recomputa status. Atomicidade garantida.

## Backward compatibility

- **Breaking change parcial**: clientes que enviavam `numChapters` (root level) deixam de funcionar. Como o único cliente do endpoint é o próprio frontend deste projeto, a migração é coordenada no mesmo PR.
- Clientes terceiros: não aplicável (API interna).

# Contract: API Error Envelope

**Branch**: `023-global-error-handler` | **Status**: stable

## Response shape

Toda resposta de erro de `/api/v1/**` carrega exatamente este envelope JSON:

```json
{
  "error": {
    "code": "<ErrorCode>",
    "message": "<mensagem PT-BR user-facing>",
    "details": <opcional, dependente do code>
  }
}
```

### `error.code`

- Tipo: `ErrorCode` (união discriminada — ver [data-model.md](../data-model.md)).
- Sempre presente em respostas 4xx/5xx.
- Sempre `UPPER_SNAKE_CASE`.
- Estável: uma vez publicado, não muda de status nem de semântica sem versionamento da API.

### `error.message`

- Sempre presente.
- Sempre PT-BR.
- Sempre proveniente de `errorCodes[code].message` (catálogo compartilhado).
- **Não** carrega IDs, nomes em inglês de domínio, fragmentos SQL, paths, stack frames, ou jargão técnico.
- **Não** é interpolada com dados dinâmicos no servidor — toda variabilidade vai para `details`.

### `error.details` (opcional)

Forma 1 — **Field errors** (`code === "VALIDATION_ERROR"`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Os dados enviados são inválidos.",
    "details": [
      { "field": "title",     "message": "Título é obrigatório." },
      { "field": "studioId",  "message": "Selecione um estúdio." }
    ]
  }
}
```

- Tipo: `ReadonlyArray<{ field: string; message: string }>`.
- `field` usa dot-notation para campos aninhados (`studio.name`).
- `message` em PT-BR (vem do schema Zod ou do `errorMap` global — D-04 do research).

Forma 2 — **Structured payload** (códigos específicos com dado de apoio):

```json
{
  "error": {
    "code": "STUDIO_HAS_ACTIVE_BOOKS",
    "message": "Este estúdio possui livros com capítulos ativos e não pode ser excluído.",
    "details": {
      "books": [
        { "id": "abc-123", "title": "Livro X" },
        { "id": "def-456", "title": "Livro Y" }
      ]
    }
  }
}
```

- Tipo: `Record<string, unknown>` (dependente do `code`).
- Cliente distingue Forma 1 vs Forma 2 por `code` (apenas `VALIDATION_ERROR` usa array).

## Response headers

### `X-Request-Id`

- Sempre presente (sucesso e erro), em todas as respostas de `/api/v1/**`.
- Tipo: UUID v4.
- Origem: gerado pelo handler global (`withApiErrorHandler`) **ou** ecoado do header de entrada `X-Request-Id` (se presente).
- Visibilidade: opaco para o usuário; útil para correlacionar com logs do servidor durante triagem.

### Outros headers

- `Cache-Control: no-store` em respostas mutáveis (já existente via `NO_STORE_HEADERS`).
- `Location` em respostas `201 Created` (já existente).
- Sem header novo introduzido por esta feature além de `X-Request-Id`.

## Status codes (referência rápida)

| Status | Quando | Código(s) típico(s) |
|--------|--------|---------------------|
| 401 | Sessão ausente/expirada | `UNAUTHORIZED` |
| 404 | Recurso da URL não existe | `<ENTITY>_NOT_FOUND` |
| 409 | Conflito de estado / unicidade | `*_ALREADY_IN_USE`, `*_LOCKED`, `*_HAS_ACTIVE_*`, `*_LINKED_TO_ACTIVE_CHAPTERS` |
| 422 | JSON inválido, schema Zod, FK em payload, transição inválida | `INVALID_BODY`, `VALIDATION_ERROR`, `*_REFERENCE_INVALID`, `CHAPTER_INVALID_TRANSITION`, etc. |
| 500 | Qualquer exceção não mapeada pelo registry | `INTERNAL_ERROR` |

## What this contract guarantees

- **Anti-leak**: nenhuma resposta de erro carrega stack, SQL, path, UUID exposto na string, nem termo em inglês relativo ao domínio (testado em `__tests__/integration/api-error-responses.spec.ts`).
- **Determinismo**: mesmo erro de domínio sempre produz mesmo `(status, code, message)`.
- **Estabilidade**: catálogo de codes só cresce; remoção/renomeação de code é breaking change e exige nova versão da rota.
- **Auditabilidade**: `X-Request-Id` correlaciona qualquer resposta com o log estruturado do servidor.

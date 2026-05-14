# Contract: PATCH `/api/v1/chapters/:id`

**Feature**: 025-chapter-deadline
**Scope**: extensão do endpoint existente — adiciona campo `deadline` no payload de update e na projeção da resposta.

---

## Request

`PATCH /api/v1/chapters/:id`

### Headers

- `Content-Type: application/json`
- `Cookie: <better-auth session>`

### Path params

| Param | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID v4 | sim | Chapter ID |

### Body (Zod: `updateChapterSchema`)

```jsonc
{
  // Todos opcionais; ≥ 1 deve ser informado.
  "status": "pending|editing|reviewing|retake|completed|paid",
  "narratorId": "uuid|null",
  "editorId": "uuid|null",
  "editedSeconds": 0,
  "deadline": "YYYY-MM-DD|null",   // ★ NOVO
  "confirmReversion": false
}
```

### Validações sobre `deadline`

| Caso | Resultado |
|---|---|
| Ausente (`deadline` não enviado) | OK; campo não é alterado. |
| `null` | OK; valor passa a `null` no banco. |
| `"YYYY-MM-DD"` válido, data calendária real | OK; persistido. |
| `"YYYY-MM-DD"` malformado (ex: `2026-13-40`, `21/06/2026`, vazio) | **422** `{ kind: "validation", errors: [{ path: ["deadline"], message: "Data limite inválida (use formato AAAA-MM-DD)." }] }` |
| Data > `hoje + 10 anos` (em `America/Sao_Paulo`) | **422** `{ kind: "validation", errors: [{ path: ["deadline"], message: "Data limite não pode ser superior a 10 anos no futuro." }] }` |
| Data no passado (qualquer) | OK; persistido (FR-003 → Q4=A). |
| Capítulo em `status = 'paid'` e `deadline` enviado | **409** `{ code: "CHAPTER_PAID_LOCKED" }` |

---

## Response

### Sucesso — `200 OK`

```jsonc
{
  "data": {
    "id": "uuid",
    "bookId": "uuid",
    "number": 3,
    "status": "editing",
    "narratorId": "uuid|null",
    "editorId": "uuid|null",
    "editedSeconds": 1200,
    "deadline": "2026-06-15",       // ★ NOVO (string YYYY-MM-DD ou null)
    "createdAt": "2026-05-01T12:00:00.000Z",
    "updatedAt": "2026-05-14T19:30:00.000Z"
  },
  "meta": { "bookStatus": "editing" }
}
```

Headers: `Cache-Control: no-store`, `X-Request-Id: <uuid>`.

### Erros

| Status | Code | Quando |
|---|---|---|
| **401** | `UNAUTHENTICATED` | Sem sessão válida |
| **404** | `CHAPTER_NOT_FOUND` | `id` inexistente |
| **409** | `CHAPTER_PAID_LOCKED` | Capítulo em `paid` AND `input` contém qualquer campo de `PAID_LOCKED_FIELDS` (`narratorId`, `editorId`, `editedSeconds`, **`deadline`**). Mensagem atualizada: `"Este capítulo já está pago — narrador, editor, duração e prazo não podem ser alterados."` |
| **422** | `ZodError` (validação) | Body inválido; payload inclui `errors: [{ path, message }]` em PT-BR |
| **422** | `CHAPTER_INVALID_TRANSITION` | Status pretendido viola state machine (inalterado) |
| **422** | `CHAPTER_NARRATOR_REQUIRED` / `CHAPTER_EDITOR_OR_SECONDS_REQUIRED` / `CHAPTER_REVERSION_CONFIRMATION_REQUIRED` | Inalterados |

---

## Domain rules afetadas

- `PAID_LOCKED_FIELDS` passa a incluir `deadline`. Service `assertPaidLocked` rejeita qualquer presença do campo quando `current.status === "paid"`.
- `withApiErrorHandler` mapeia automaticamente `ZodError` para envelope `validation` e `DomainError` para `api-error`.
- Headers `NO_STORE_HEADERS` mantidos.

---

## Test plan (este contrato)

### Unit (schema)

- `updateChapterSchema.parse({ deadline: "2026-06-15" })` → OK.
- `updateChapterSchema.parse({ deadline: null })` → OK.
- `updateChapterSchema.parse({ deadline: "2026-13-01" })` → throw com mensagem "Data limite inválida".
- `updateChapterSchema.parse({ deadline: "0001-01-01" })` → OK (passado distante).
- `updateChapterSchema.parse({ deadline: "9999-12-31" })` → throw "não pode ser superior a 10 anos".

### Integration (service + repo + DB real)

- Update com `deadline` válido persiste e a próxima leitura retorna a string ISO igual.
- Update com `deadline: null` em capítulo com prazo apaga o valor.
- Update em capítulo `paid` com `deadline` lança `ChapterPaidLockedError` (passa pelo mecanismo existente).
- Update em capítulo `paid` SEM `deadline` (mas com outro campo trancado) continua falhando — sem regressão.
- Update bem-sucedido **não** dispara `recomputeBookStatus` extra além do que já dispara hoje (prazo não muda status do livro).

### Contract test (route handler)

- `PATCH /api/v1/chapters/:id { deadline: "2026-06-15" }` retorna 200 com `data.deadline === "2026-06-15"`.
- Mesmo endpoint com `deadline: "2026-13-01"` retorna 422 com erro estruturado em PT-BR.
- Mesmo endpoint em capítulo `paid` com `deadline` retorna 409 + mensagem PT-BR atualizada.

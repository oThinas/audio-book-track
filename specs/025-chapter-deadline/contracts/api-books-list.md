# Contract: GET `/api/v1/books`

**Feature**: 025-chapter-deadline
**Scope**: extensão do endpoint existente — adiciona campo derivado `focusThisWeekCount` ao DTO de cada livro.

---

## Request

`GET /api/v1/books`

### Headers

- `Cookie: <better-auth session>`

### Query params

| Param | Type | Required | Notes |
|---|---|---|---|
| (sem novos params) | — | — | Endpoint mantém o contrato atual; cálculo é sempre feito. |

> Decisão: `focusThisWeekCount` é cheap o suficiente para ser sempre retornado (single query). Não criar `?include=focus` para evitar combinatória.

---

## Response — `200 OK`

```jsonc
{
  "data": [
    {
      "id": "uuid",
      "title": "Livro Teste",
      "studio": { "id": "uuid", "name": "Estúdio X" },
      "pricePerHourCents": 6000,
      "pdfUrl": null,
      "status": "editing",
      "totalChapters": 12,
      "completedChapters": 4,
      "totalEarningsCents": 24000,
      "focusThisWeekCount": 3,    // ★ NOVO
      "createdAt": "2026-04-01T...",
      "updatedAt": "2026-05-13T..."
    }
  ]
}
```

### Definição de `focusThisWeekCount`

Quantidade de capítulos do livro tal que:

```
status IN ('pending', 'editing', 'reviewing', 'retake')
AND deadline IS NOT NULL
AND (
  deadline < :today
  OR deadline BETWEEN :monday AND :sunday
)
```

onde:

- `:today`, `:monday`, `:sunday` são calculados em `America/Sao_Paulo` no momento da requisição (no service), independentemente do TZ do servidor ou do cliente.
- `:monday` e `:sunday` são os limites inclusivos da semana civil corrente (seg–dom, weekStartsOn=1).

Valor sempre ≥ 0. Quando 0, o frontend **não** renderiza a badge (FR-026).

---

## Implementação server-side

### Repository

```ts
// BookRepository
listSummaries(opts: ListSummariesOptions, tx?: RepositoryTx): Promise<BookSummary[]>;

interface ListSummariesOptions {
  todayIso: string;
  mondayIso: string;
  sundayIso: string;
}
```

Drizzle (parcial):

```ts
.select({
  // ... existentes ...
  focusThisWeekCount: sql<number>`
    coalesce(
      count(${chapter.id}) filter (
        where ${chapter.status} in ('pending','editing','reviewing','retake')
        and ${chapter.deadline} is not null
        and (
          ${chapter.deadline} < ${opts.todayIso}
          or ${chapter.deadline} between ${opts.mondayIso} and ${opts.sundayIso}
        )
      ),
      0
    )::int
  `,
})
.from(book)
.innerJoin(studio, eq(studio.id, book.studioId))
.leftJoin(chapter, eq(chapter.bookId, book.id))
.groupBy(book.id, studio.id, studio.name)
.orderBy(desc(book.createdAt));
```

### Service

```ts
async list(): Promise<BookSummary[]> {
  const todayIso = todayInAppTimezone();
  const { mondayIso, sundayIso } = currentWeekRangeInAppTimezone();
  return this.repo.listSummaries({ todayIso, mondayIso, sundayIso });
}
```

### Route

Inalterada do ponto de vista de orquestração; só passa o resultado com o campo novo.

---

## Consistência com `/books/:id` (FR-027)

O hook `useFocusWeekFilter` no front da página de detalhe usa **as mesmas regras** que a SQL acima:

```ts
function isInFocusWeek(c: Chapter, ctx: FocusWeekContext): boolean {
  if (!c.deadline) return false;
  if (!ACTIVE_STATUSES.has(c.status)) return false;
  return c.deadline < ctx.todayIso || (c.deadline >= ctx.mondayIso && c.deadline <= ctx.sundayIso);
}
```

Garantia testada: para qualquer livro com N na badge, abrir `/books/:id` e ligar o filtro deve mostrar exatamente N capítulos.

---

## Test plan

### Unit (helpers)

- `todayInAppTimezone(() => new Date("2026-05-14T01:00:00.000Z"))` → `"2026-05-13"` (em SP ainda é dia 13). [edge da meia-noite]
- `currentWeekRangeInAppTimezone(() => new Date("2026-05-14T12:00:00.000Z"))` (quarta) → `{ mondayIso: "2026-05-11", sundayIso: "2026-05-17" }`.
- Caso `now` é domingo → semana atual ainda termina nesse domingo.
- Caso `now` é segunda 00:01 SP → semana atual começa nesse dia.

### Integration (repo + DB real)

Cenário fixture com 1 livro e capítulos:

| Status | Deadline | Esperado contar? |
|---|---|---|
| pending | hoje−5 | ✅ (atrasado) |
| editing | segunda da semana | ✅ |
| reviewing | sábado da semana | ✅ |
| retake | domingo da semana | ✅ |
| completed | sexta da semana | ❌ |
| paid | quarta da semana | ❌ |
| pending | segunda+7 (próxima seg) | ❌ |
| pending | null | ❌ |
| editing | hoje (date = today) | ✅ (dentro da semana) |

Conferir `focusThisWeekCount` === 5 contado server-side.

### Contract test (route handler)

- `GET /api/v1/books` retorna 200 com `data[*].focusThisWeekCount: number`.
- Para um livro inexistente no banco, resposta omite naturalmente (não há item).

### E2E (smoke)

- Criar livro + 3 capítulos (1 atrasado pending, 1 dentro da semana editing, 1 paid).
- Abrir `/books` → linha desse livro tem célula "Foco" com badge "Foco da semana · 2".
- Abrir `/books/:id` → ligar filtro → ver 2 linhas.

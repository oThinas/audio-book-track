# Research: Data Limite por Capítulo

**Feature**: 025-chapter-deadline
**Date**: 2026-05-14
**Phase**: 0 — outline & research

> Nenhum `[NEEDS CLARIFICATION]` herdado da spec. O grill-me consumiu 26 perguntas e fechou todas as decisões de produto. Esta fase resolve apenas as **decisões técnicas** que decorrem do produto.

---

## 1. Bibliotecas de data: cálculo de semana civil + fuso fixo

**Decisão**: usar `date-fns` 4.x + `date-fns-tz` 3.x.

**Rationale**:

- Precisamos de três operações: (a) "hoje" em `America/Sao_Paulo`, (b) limites de semana civil seg–dom em `America/Sao_Paulo`, (c) formatação relativa em pt-BR ("em N dias" / "atrasado há N dias" / "hoje" / "amanhã").
- `date-fns` é tree-shakable (cada função é um import isolado), zero dependências e suporta `Locale` pt-BR nativamente (`date-fns/locale/pt-BR`).
- `date-fns-tz` adiciona `toZonedTime` / `fromZonedTime` para trabalhar em fuso fixo sem depender de `process.env.TZ` (FR-007, FR-024).
- Substituto da v3 `format` que mantém compatibilidade com locale.

**Alternativas consideradas**:

- `dayjs` + plugins (`timezone`, `weekOfYear`, `relativeTime`): API mutável, comportamento histórico de plugins (carrega plugin para usar), bundle ligeiramente maior depois de plugins. Rejeitado: time prefere a API imutável e funcional de date-fns.
- `Temporal` nativo (Stage 3): excelente API, mas indisponível ainda em Node/Bun sem polyfill. Rejeitado: feature não justifica adotar polyfill agora.
- Cálculo manual com `Date` + `Intl.DateTimeFormat`: viável para "hoje em pt-BR", mas fragmenta-se para "semana civil ancorada na segunda". Rejeitado: maior superfície de bugs por hand-rolling.

**Funções concretas a usar**:

- `date-fns/startOfWeek(date, { weekStartsOn: 1 })` — segunda como primeiro dia.
- `date-fns/endOfWeek(date, { weekStartsOn: 1 })` — domingo (com 23:59:59 truncado para `date`).
- `date-fns/differenceInCalendarDays(a, b)` — base do tooltip relativo (`"em N dias"` / `"atrasado há N dias"`).
- `date-fns-tz/toZonedTime(date, "America/Sao_Paulo")` — converter um `Date` UTC para parede em SP.
- `date-fns/format(date, "dd/MM/yyyy", { locale: ptBR })` — formato exibido na célula.

**Constante**:

```ts
// src/lib/domain/timezone.ts
export const APP_TIMEZONE = "America/Sao_Paulo" as const;
```

---

## 2. Date picker visual: react-day-picker via shadcn Calendar

**Decisão**: adicionar `components/ui/calendar.tsx` via `bunx --bun shadcn@latest add calendar`. Configurar locale `ptBR` (de `date-fns/locale/pt-BR`).

**Rationale**:

- shadcn é a biblioteca de UI padrão do projeto (CLAUDE.md). `Calendar` é wrapper sobre `react-day-picker` 9.x, integrado a `Popover` para "date picker" canônico.
- Suporte nativo a `locale`, semana começando em qualquer dia, range de datas, disabled days, single/multiple/range — só usamos single.
- Acessível (ARIA, navegação por teclado, foco visível) por padrão.

**Alternativas consideradas**:

- `<Input type="date">` HTML nativo: zero dependência, mas visual é incontrolável (Chrome × Firefox × Safari diferentes), dark mode pobre, locale do browser pode contrastar com locale da app. Rejeitado pela inconsistência visual.
- React Aria DatePicker (Adobe): excelente, mas introduz outro design system. Rejeitado: ficamos com shadcn pra consistência.

**Configuração concreta**:

```tsx
<Calendar
  mode="single"
  selected={value ?? undefined}
  onSelect={onSelect}
  locale={ptBR}
  weekStartsOn={1}     // segunda
  disabled={isPaid}
  fromYear={currentYear - 10}
  toYear={currentYear + 10}
/>
```

**Botão "Limpar"**: footer customizado no `Popover` (após o `Calendar`), com `<Button variant="ghost" size="sm" onClick={() => onSelect(null)}>Limpar</Button>`. Distinto de "Cancelar" (apenas fecha o popover, mantém valor anterior).

---

## 3. Coluna `deadline` em PostgreSQL: tipo `date`

**Decisão**: `chapter.deadline` é `date NULL`. Drizzle `date("deadline", { mode: "string" })`.

**Rationale**:

- Q3 → tipo data pura (sem hora). O tipo SQL `date` é exatamente isso (4 bytes, sem fuso, sem hora).
- Drizzle expõe `mode: "string"` para retornar `YYYY-MM-DD` (string ISO) em vez de `Date` (UTC) — evita off-by-one por fuso na desserialização. A API e o domínio operam em string `YYYY-MM-DD`. Conversão para objeto temporal acontece apenas onde for computar (filtro, tooltip).
- Para o lado domínio, manteremos como `string | null` no tipo `Chapter` (alinhado a `mode: "string"`). Documentar no contrato.

**Alternativas consideradas**:

- `timestamptz`: introduz hora e fuso, não casa com Q3. Rejeitado.
- `mode: "date"` (Drizzle): retorna `Date` JS interpretado como UTC midnight → risco de off-by-one ao serializar. Rejeitado.

**Validação a montante (Zod)**:

```ts
const deadlineSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD).")
  .refine(isCalendarValid, { message: "Data inválida." })
  .refine(isWithinTenYears, { message: "Prazo não pode ser superior a 10 anos no futuro." })
  .nullable();
```

`isCalendarValid` rejeita `2026-02-30`. `isWithinTenYears` aplica FR-003.

---

## 4. Índices

**Decisão**: adicionar índice parcial `chapter_deadline_active_idx` em `(deadline)` `WHERE deadline IS NOT NULL`.

**Rationale**:

- A maioria dos capítulos pré-existentes terá `deadline = null`; índice parcial mantém o tamanho enxuto e foco nos registros que importam para o filtro/badge.
- As queries de "atrasados" / "foco da semana" filtram por `deadline IS NOT NULL AND deadline <= :date_x AND status IN (...)`. O índice cobre o primeiro filtro; PostgreSQL combina com `chapter_book_status_idx` existente quando útil.

**Alternativas consideradas**:

- Índice composto `(book_id, deadline)` para acelerar a query da badge no `listSummaries`. Avaliado: provavelmente desnecessário porque o `LEFT JOIN` já agrega capítulos por `book_id` e o filtro `deadline` reduz pouco (capítulos por livro são poucos — até dezenas). Pode ser adicionado depois se virar gargalo observado.
- Índice completo em `deadline`: gasto de IO desnecessário para milhares de linhas com `null`. Rejeitado.

---

## 5. Filtro "Foco da semana": cálculo server-side vs. client-side

**Decisão**:

- Na **tabela `/books/:id`** (lista todos os capítulos do livro), filtrar **client-side**. A página já carrega todos os capítulos para render (e o agrupamento da feature 024 também atua client-side). Aplicar `useFocusWeekFilter(chapters, todayInSP, weekRangeInSP)` consistente.
- Na **lista `/books`** (badge "Foco da semana · N"), a contagem é **server-side** no `listSummaries` do `BookRepository`. Single query com `LEFT JOIN chapter` + agregação condicional.

**Rationale**:

- Tabela do livro já tem o dado em memória — filtrar no client evita refetch e mantém o pattern existente (feature 024).
- Lista de livros precisa de contagem agregada por livro; trazer todos os capítulos para o front seria N+1 e perda de performance (SC-008). Mantém o pattern de `listSummaries` já estabelecido.

**Query proposta (parcial, dentro de `listSummaries`)**:

```sql
SELECT
  ...,
  COUNT(*) FILTER (
    WHERE chapter.status IN ('pending','editing','reviewing','retake')
    AND chapter.deadline IS NOT NULL
    AND (
      chapter.deadline < :today
      OR chapter.deadline BETWEEN :monday AND :sunday
    )
  )::int AS focus_this_week_count
FROM book
LEFT JOIN chapter ON chapter.book_id = book.id
INNER JOIN studio ON ...
GROUP BY book.id, studio.id, studio.name
```

`:today`, `:monday`, `:sunday` são calculados em `America/Sao_Paulo` no service e injetados como `date`.

---

## 6. URL state: extensão do padrão da feature 024

**Decisão**: novo módulo `src/lib/url/focus-param.ts` com `parseFocusParam(searchParams)` / `serializeFocusParam(value)`. Único valor reconhecido: `"week"`. Qualquer outro valor → `null` (filtro desligado).

**Rationale**:

- Padrão já estabelecido em `src/lib/url/grouping-param.ts` (feature 024). Apenas replicar.
- A serialização simples (`?focus=week` ou ausência) é o suficiente; nada de URL-encoding de objetos.
- Coexiste naturalmente com `?group=...` (feature 024): cada param ortogonal.

**Hook integrador**:

```ts
function useFocusWeekFilter(): {
  enabled: boolean;
  toggle: () => void;
}
```

Atualiza a URL via `router.replace(`?${updatedSearch}`)` preservando outros params.

---

## 7. Mensagens de erro novas no catálogo

**Decisão**: adicionar 2 novos códigos a `src/lib/api/error-codes/chapter.ts`. Estender mensagem de `CHAPTER_PAID_LOCKED` para incluir prazo.

**Rationale**:

- Padrão estabelecido pela feature 023. `withApiErrorHandler` mapeia `DomainError` → envelope PT-BR.

**Códigos**:

| Code | Status | Mensagem PT-BR |
|---|---|---|
| `CHAPTER_DEADLINE_INVALID` | 422 | "Data limite inválida." |
| `CHAPTER_DEADLINE_TOO_FAR` | 422 | "Data limite não pode ser superior a 10 anos no futuro." |
| `CHAPTER_PAID_LOCKED` | 409 | **atualizar texto** para "Este capítulo já está pago — narrador, editor, duração e prazo não podem ser alterados." |

Nota: Zod cobre a validação de formato/teto via schema, então o `CHAPTER_DEADLINE_INVALID` é mapeado a partir do `ZodError` pelo `withApiErrorHandler` (já existe pipeline). `CHAPTER_DEADLINE_TOO_FAR` idem.

`PAID_LOCKED_FIELDS` no `chapter-service.ts` passa a ser `["narratorId", "editorId", "editedSeconds", "deadline"]`. Já lança `ChapterPaidLockedError`.

---

## 8. Coexistência com feature 024 (agrupamento)

**Decisão**: filtro e agrupamento são **ortogonais**, aplicados em pipeline: filtrar primeiro pela "Foco da semana" se ativo, então agrupar o resultado.

**Rationale**:

- Spec FR-023 exige coexistência.
- O agrupamento já roda em hook (`use-chapters-grouping-state`). O filtro novo roda em hook irmão. A ordem importa: filtrar antes evita agrupar capítulos que serão ocultados.

**Composição (pseudo-código)**:

```ts
const filtered = useFocusWeekFilter(chapters); // aplica se ?focus=week
const grouped = useChaptersGroupingState(filtered, groupingParams); // 024
```

E2E na feature 024 já cobre o caso geral; o novo E2E acrescenta o caso combinado.

---

## 9. Acessibilidade e dark mode

**Decisão**: cor de risco via `text-destructive` (token shadcn) + ícone `lucide-react/AlertCircle`. `aria-label="Atrasado"` na célula da tabela. Tooltip via shadcn `Tooltip`.

**Rationale**:

- Princípio IX: design tokens para tudo. Sem hardcoding.
- Princípio VII menciona dark mode obrigatório — `text-destructive` adapta automaticamente.
- Cor sozinha falha em WCAG; ícone + `aria-label` mitigam.

---

## 10. Testabilidade

**Decisão**: criar fakes/factories dedicadas:

- `__tests__/helpers/factories.ts` (existe) → adicionar `createTestChapterWithDeadline(db, overrides)`.
- `__tests__/repositories/in-memory-chapter-repository.ts` — atualizar para suportar `deadline` (se já existe in-memory; verificar — provavelmente sim, dado o padrão do projeto).
- Helper `freezeDate(iso: string)` para testes unit que dependem de "hoje". Mock de "hoje" via injeção de função (`() => Date`) no helper de domínio, jamais via `vi.useFakeTimers()` global.

**Rationale**:

- Constituição V: convenção de test doubles favorece fakes manuais via injeção.
- Spec: "É preciso testar combinações status × prazo" → tabela de teste paramétrico.
- Para `chapter-deadline` helpers puros: testar com data fixa, semana fixa, e capítulos sintetizados.

---

## 11. Migração e backfill (decisão de plano)

**Decisão**: migration ALTER TABLE com coluna nullable, **sem backfill**, **sem default**.

**Rationale**:

- Q26 + FR-033: spec explícita. Nada a inventar.
- Reversibilidade: `DROP COLUMN deadline` desfaz limpo.

**Comando Drizzle**:

```bash
bunx drizzle-kit generate    # gera 0007_*.sql automaticamente
bunx drizzle-kit migrate     # aplica no DB local
```

Migration final esperada (verificada após generate):

```sql
ALTER TABLE "chapter" ADD COLUMN "deadline" date;

CREATE INDEX "chapter_deadline_active_idx" ON "chapter" ("deadline")
WHERE "deadline" IS NOT NULL;
```

---

## Decisões consolidadas (cheatsheet)

| Tema | Decisão | Referência |
|---|---|---|
| Lib de data | `date-fns` + `date-fns-tz` | §1 |
| Date picker | shadcn `Calendar` (react-day-picker) | §2 |
| Tipo SQL | `date` nullable, Drizzle `mode: "string"` | §3 |
| Índice | parcial `WHERE deadline IS NOT NULL` | §4 |
| Onde filtra | tabela: client / badge: server | §5 |
| URL state | `?focus=week`, padrão da 024 | §6 |
| Erros | 2 novos códigos + atualizar `CHAPTER_PAID_LOCKED` | §7 |
| Composição com 024 | filtra antes de agrupar | §8 |
| A11y | token `text-destructive` + ícone + aria-label | §9 |
| Testes | fakes + helper `freezeDate` injetável | §10 |
| Migração | `date NULL`, sem backfill | §11 |

Todas as decisões respeitam a constituição. Plano pronto para Phase 1.

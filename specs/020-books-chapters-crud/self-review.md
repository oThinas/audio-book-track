# Self-Review: 020 Books & Chapters CRUD

**Data**: 2026-04-29
**Feature**: CRUD de Livros e Capítulos + soft-delete unificado, derived columns, recomputação de `book.status`
**Branch**: `020-books-chapters-crud`

Checklist mapeando cada princípio da constituição (v2.13.0) a evidências concretas
nesta feature. Os desvios reconhecidos no [plan.md](./plan.md#constitution-check)
estão documentados e não pioram com a implementação.

## I. Capítulo como unidade de trabalho

Toda atribuição (narrador/editor), edição de horas (`editedSeconds`) e transição
de status acontecem no capítulo. `book.status` é **cache materializado** computado
por [src/lib/services/book-status-recompute.ts](../../src/lib/services/book-status-recompute.ts)
a partir do mínimo do ciclo dos capítulos. O book nunca é fonte da verdade.

Recomputação síncrona em transação:

- Após delete de capítulo → recompute (FR-051a)
- Após bulk delete → recompute (chapters-bulk-delete-bar)
- Após mudança de status do capítulo → recompute (chapter PATCH)
- Após reversão `paid → completed` → recompute

## II. Precisão financeira

Valores em `integer` centavos com sufixo `_cents`:

- `book.price_per_hour_cents` (imutável quando `book.status = paid`)
- `studio.default_hourly_rate_cents`

Duração em `integer` segundos com sufixo `_seconds`:

- `chapter.edited_seconds`

Cálculo de ganho centralizado em [src/lib/domain/earnings.ts](../../src/lib/domain/earnings.ts):
`round(editedSeconds × pricePerHourCents / 3600)` half-away-from-zero, retorno em
centavos. **100% de cobertura** (validado em T142a). Nenhum `float`/`numeric` no
caminho do cálculo.

Trava de imutabilidade: tentar alterar `pricePerHourCents` em livro `paid` retorna
409 `BOOK_PAID_PRICE_LOCKED` ([book-service.ts](../../src/lib/services/book-service.ts)
+ [book-edit-dialog.tsx](../../src/components/features/books/book-edit-dialog.tsx)
desabilita o campo com tooltip explicativo).

**Desvio reconhecido (II/III)**: `paid → completed` controlado existe, mas não
muda `editedSeconds`/`pricePerHour` — apenas o status. Confirmação dupla via
`confirmReversion: true` (state machine) + AlertDialog
([chapter-paid-reversion-dialog.tsx](../../src/components/features/chapters/chapter-paid-reversion-dialog.tsx)).

## III. Integridade do ciclo de vida

Máquina de estados em [chapter-state-machine.ts](../../src/lib/domain/chapter-state-machine.ts)
com **100% de cobertura** (validado em T142a). Transições:

- `pending → editing` exige narrador atribuído
- `editing → reviewing` exige editor + `editedSeconds > 0`
- `reviewing → retake | completed` (livre)
- `retake → reviewing` (livre)
- `completed → paid | reviewing` (livre)
- `paid → completed` apenas com `confirmReversion: true` (único retrocesso permitido)

Toda transição inválida retorna `INVALID_STATUS_TRANSITION`. O guard `default never`
das exhaustiveness checks também é coberto por teste (`status inesperado`).

## IV. Simplicidade justificada (YAGNI)

- Soft-delete unificado: uma única coluna `deleted_at` em `studio/narrator/editor` +
  índice único parcial `WHERE deleted_at IS NULL` — sem tabelas separadas, sem
  triggers, sem coluna `archived_at` paralela.
- `findAllWithCounts()` em vez de uma rota `/studios/counts` separada — mantém
  a derived column dentro da listagem principal, sem duplicar SQL.
- `BookStatusRecomputeService` como serviço dedicado em vez de método em
  `BookService` — testável isoladamente e reutilizado por `ChapterService` +
  rotas de bulk delete.
- Reusamos `BlockingBookSummary` (de `studio-errors.ts`) em
  `narrator-errors.ts`/`editor-errors.ts` em vez de tipos paralelos.

Decisões deferidas registradas em [research.md](./research.md): viewer de PDF
(SCOPE-SPLIT), KPI dashboards (escopo de outra feature).

## V. TDD + cobertura

**Todos os testes foram escritos antes da implementação.** Evidência: cada phase
nas tasks.md alterna entre uma task de teste (RED) e uma de implementação (GREEN),
com run explícito antes da implementação documentado nos commits.

Cobertura final (T142a, `bun run test:unit --coverage`):

| Camada | Arquivo | Statements |
|--------|---------|------------|
| Domain (cálculo crítico) | `book-status.ts` | **100%** |
| Domain (cálculo crítico) | `chapter-state-machine.ts` | **100%** |
| Domain (cálculo crítico) | `earnings.ts` | **100%** |
| Domain | overall | 93% |
| Services | overall | 97% |
| Errors | overall | 96% |
| Schemas | overall | 100% |

**SC-010 cumprido**: `book-status.ts` + `chapter-state-machine.ts` em 100%.
Cobertura ≥ 80% para arquivos novos com lógica.

Repositórios/factories aparecem em 0%/baixo no relatório unit porque são testados
exclusivamente em `__tests__/integration/` (DB real, BEGIN/ROLLBACK) — Princípio V
explicitamente classifica isso como integration test.

## VI. Clean Architecture

Dependências fluem de fora para dentro. Para cada nova entidade:

- **Controllers**: [src/app/api/v1/books/route.ts](../../src/app/api/v1/books/route.ts) +
  `[id]/route.ts` + `[id]/chapters/*` — apenas session guard, Zod parse, factory,
  error mapping para `responses.ts`.
- **Factory**: [src/lib/factories/book.ts](../../src/lib/factories/book.ts),
  [chapter.ts](../../src/lib/factories/chapter.ts) — únicos pontos que injetam
  Drizzle adapters + `SavepointUnitOfWork`.
- **Service**: [src/lib/services/book-service.ts](../../src/lib/services/book-service.ts),
  [chapter-service.ts](../../src/lib/services/chapter-service.ts) — orquestração;
  recebe portas via construtor.
- **Repository ports**: `src/lib/repositories/{book,chapter}-repository.ts` (raiz);
  Drizzle adapters em `src/lib/repositories/drizzle/`. Constituição cumprida: ports
  fora de `domain/`.
- **Domain**: `src/lib/domain/{book,chapter,book-status,earnings,chapter-state-machine}.ts` —
  puramente regras + value types, sem `import` de `drizzle` ou `next`.

Nenhum prefixo `I` em interfaces; repositórios concretos prefixados (`DrizzleBookRepository`,
`DrizzleChapterRepository`).

## VII. Frontend

- **shadcn/ui primitivos** usados em todo lugar: `Dialog`, `AlertDialog`, `Popover`,
  `Tooltip`, `Checkbox`, `Command` (combobox de estúdio), `Tabs`, `Form`/`Field` etc.
  Verificado em T001 que todos estavam instalados.
- **Componentes de feature** em `src/components/features/{books,chapters,studios,narrators,editors}/`
  — nenhum `_components/` dentro de `src/app/`.
- **Sem HTML cru**: todos os botões usam `Button`, todos os inputs usam `Input`,
  todos os selects usam `Select`/`Combobox`.
- **PageContainer + layout components** em `/books`, `/books/[id]`, `/studios`,
  `/narrators`, `/editors`.
- **Server Components por padrão**: páginas são server; `use client` apenas em
  componentes de feature interativos. Data fetching de detalhe do livro via
  Server Component (`src/app/(authenticated)/books/[id]/page.tsx`).
- **Dark mode** via tokens semânticos verificado em T137. **Achado e corrigido**:
  três `AlertDialogAction` usavam `text-white` em vez de `text-destructive-foreground`
  ([delete-studio-dialog.tsx](../../src/components/features/studios/delete-studio-dialog.tsx#L96),
  [delete-narrator-dialog.tsx](../../src/components/features/narrators/delete-narrator-dialog.tsx#L96),
  [delete-editor-dialog.tsx](../../src/components/features/editors/delete-editor-dialog.tsx#L96)).
- **Mobile first**: tabelas têm `ScrollArea` para overflow horizontal; layouts
  usam grid responsivo; popovers/dialogs respeitam breakpoint mobile.

## VIII. Performance

- **Server Components** para páginas de listagem e detalhe — `use client` é
  mínimo (apenas tabelas, dialogs e forms).
- **COUNT em single query** com `LEFT JOIN + GROUP BY` em uma única ida ao DB —
  validado por T142b: overhead **~0.6ms** vs. 100ms de teto (SC-011 aprovado).
- **Memoização** das listas filtradas via `useMemo` no client (sorting/filtros);
  nada de `useEffect` para derivar estado.
- Bundle não cresceu com libs externas — tudo construído em cima dos primitivos
  já instalados.

## IX. Design tokens

Cores via tokens semânticos (`bg-background`, `text-foreground`, `text-muted-foreground`,
`bg-destructive`, `text-destructive-foreground`, `border-border`, `border-input` etc.).
Spacing/radius via Tailwind; nenhum px/hex hardcoded em `className` dos componentes
de feature. Audit T137 confirmou (após o fix dos `text-white`).

## X. API REST

- URLs em plural kebab-case: `/api/v1/books`, `/api/v1/books/:id`,
  `/api/v1/books/:id/chapters/bulk-delete`, `/api/v1/chapters/:id`.
- Status codes: `200` (list/update/detail), `201` (create), `204` (delete),
  `401`, `404`, `409` (conflitos de domínio: nome duplicado, preço travado,
  estúdio travado, soft-delete bloqueado), `422` (Zod ou regras de domínio),
  `500` apenas para erros não mapeados (rethrow → handler default do Next).
- Envelope `{ data }` em sucesso; `{ error: { code, message, details? } }` em erro.
- Input validado com Zod em **toda** rota (T142c valida 422/409/500 sem leak).
- Nunca retorna `200` com `{ success: false }`.
- Stack traces e SQL **não vazam** — validado por
  `__tests__/integration/api-error-responses.spec.ts` (T142c).

## XI. Banco de dados

- `price_per_hour_cents`, `default_hourly_rate_cents`, `edited_seconds` como
  `integer` (sufixos `_cents`/`_seconds`). Sem `numeric`/`float` no caminho
  financeiro.
- FKs com índice em todas as relações (`book_studio_id_idx`,
  `chapter_book_id_idx`, `chapter_narrator_id_idx`, `chapter_editor_id_idx`).
- `SELECT *` proibido — todas as queries em `repositories/drizzle/` listam
  colunas explícitas via constantes `*_COLUMNS`.
- Soft-delete unificado com índice único parcial `studio_name_unique_active`
  (`WHERE deleted_at IS NULL`, case-insensitive via `lower()`) — validado em
  `__tests__/integration/soft-delete-unification.spec.ts`.
- **Transações** em operações multi-tabela:
  - `BookService.delete()` (recompute do book.status do mesmo book? — N/A; deleta
    o book inteiro)
  - `ChapterService.delete()` + `recomputeBookStatus` no mesmo `SavepointUnitOfWork`
  - `BookService.create({ inline: true })` cria estúdio e livro atomicamente
  - Bulk delete de capítulos + recompute em uma única transação
- **Migrations**: geradas via `drizzle-kit generate`, aplicadas via
  `drizzle-kit migrate`. Nenhum `drizzle-kit push`. Migrations reversíveis.

## XII. Anti-padrões proibidos

| Anti-padrão | Status |
|-------------|--------|
| `any` sem justificativa | ❌ Inexistente. Único `any` é `// biome-ignore` no teste do exhaustiveness guard, com justificativa. |
| Segredos hardcoded | ❌ Inexistente. |
| `console.log` em produção | ❌ Inexistente. |
| `useEffect` para derivar estado | ❌ Inexistente — usamos `useMemo`. |
| Cores/spacing hardcoded | ❌ Corrigido em T137. |
| HTML cru no lugar de `components/ui/` | ❌ Inexistente. |
| `_components/` em `src/app/` | ❌ Inexistente. |
| Página autenticada sem `PageContainer` | ❌ Inexistente. |
| Dark mode quebrado | ❌ Validado por T137 + tokens semânticos. |
| Lógica de negócio em controllers | ❌ Controllers só fazem session/Zod/factory/error-mapping. |
| SQL fora de repositories | ❌ Único SQL fora é o seed-helper de E2E e o stress-test perf, ambos isolados. |
| `catch (e) {}` silencioso | ❌ Todos os catches re-throwam ou mapeiam para resposta. |
| Mutação de parâmetros | ❌ Services retornam novos objetos via `{ ...input, … }`. |
| `drizzle-kit push` | ❌ Apenas `generate` + `migrate`. |

## XIII. Métricas e KPIs

`edited_seconds` já coletado em capítulos alimenta o KPI 4 ("Minutagem média
por capítulo"). Nenhum campo novo é necessário. Sem desvio versus a constituição.

## XIV. Visualização de PDF

**SCOPE-SPLIT reconhecido (plan.md)**: esta feature persiste apenas
`book.pdf_url` (campo opcional, validado por Zod com regex `^https?://i`,
máx. 2048 chars) e expõe um popover ([book-pdf-popover.tsx](../../src/components/features/books/book-pdf-popover.tsx))
para edição + link "Abrir em nova guia" (`target="_blank"` `rel="noopener noreferrer"`).
O viewer completo descrito no Princípio XIV (lazy, paginação, zoom) **fica
fora de escopo** desta feature e será tratado em entrega futura, conforme
acordado com o produtor.

## XV. Skills obrigatórias

- **Context7 MCP** consultado para React 19 (`useFormState`), Drizzle (`alias`,
  `selectDistinct`, `LEFT JOIN`), Zod (`regex` + `nullable().optional()`),
  shadcn `Popover` API (`render` prop).
- **Pencil MCP**: `design.pen` consultado nas fases de UI (Node `YeFYS` para
  detalhes de livro, frame "Capítulos").
- Workflow speckit completo: `/speckit-specify`, `/speckit-plan`,
  `/speckit-tasks`, `/speckit-implement` (15 fases), `/speckit-analyze`
  (checklist `requirements.md`), `/conventional-commits` em cada commit.

## XVI. Verificação final

Será executada agora pelo Final Quality Gate (T143-T148):

- `bun run lint` — zero erros e zero warnings do Biome
- `bun run test:unit` — toda a suíte
- `bun run test:integration` — toda a suíte
- `bun run test:e2e` — toda a suíte (incluindo o novo `derived-columns-perf.spec.ts`)
- `bun run build` — produção compila

---

**Resultado**: Todos os princípios aplicáveis estão atendidos com evidência
concreta. Os 3 desvios reconhecidos no plan.md (II+III, XIV) permanecem
controlados e documentados — nenhum desvio adicional foi introduzido durante
a implementação.
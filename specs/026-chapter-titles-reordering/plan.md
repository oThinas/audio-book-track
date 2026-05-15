# Implementation Plan: Chapter titles, reordering, and extra-chapter templates

**Branch**: `026-chapter-titles-reordering` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-chapter-titles-reordering/spec.md`

## Summary

Substituir `chapter.number` (rótulo + chave de ordenação acoplados) por dois conceitos independentes:

- **`chapter.title`** (`text NOT NULL`, max 100 chars, trim no servidor, qualquer Unicode exceto `\n`/`\r`) — rótulo canônico do capítulo. Capítulos numerados nascem com `Capítulo N`; templates editoriais (`Prólogo`/`Epílogo`/`Apresentação`) nascem com o nome do template; capítulos personalizados recebem texto livre. Entra em `PAID_LOCKED_FIELDS` (imutável quando `paid`).
- **`chapter.position`** (`integer NOT NULL`, `>= 0`, único por livro, densa `0..N-1`, unique constraint `DEFERRABLE INITIALLY DEFERRED`) — chave de ordenação. **Não** entra em `PAID_LOCKED_FIELDS` — reorder é liberado em qualquer status.

Adicionar **`book.chapters_version`** (`integer NOT NULL DEFAULT 0`), bumpada em toda mutação de capítulo dentro do `BookStatusRecomputeService`, para detecção de conflito concorrente em reorder/add com mensagem PT-BR via catálogo `errorCodes`.

Substituir o caminho implícito de criação de capítulos (aumentar `numChapters` no diálogo de edição) por um caminho explícito único: **botão `+ Adicionar capítulo`** na página de detalhe do livro, com seletor de tipo (numerado / template `Prólogo`/`Epílogo`/`Apresentação` / personalizado) e posição (`no início` / `no fim` / `depois de…`). O mesmo componente é reaproveitado na seção de extras do diálogo de criação.

Reordenação via híbrido **drag-and-drop (`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`) + botões ↑/↓** visíveis em cada linha (acessibilidade por teclado + fallback mobile). Persistência atômica via endpoint declarativo `PUT /api/v1/books/:bookId/chapters/order` com `{ orderedIds, expectedVersion }`.

Migration única e reversível: drop `number` → add `title` (backfill `'Capítulo ' || number::text`) + `position` (backfill `row_number() over (partition by book_id order by number) - 1`) + `chapters_version` em `book` (default 0).

Stack inalterada: Next.js 16 App Router + Drizzle ORM (PostgreSQL) + Zod + React Hook Form + shadcn/ui + Tailwind 4 + Sonner. Novas deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner).
**Primary Dependencies**: Next.js 16.2.1 (App Router + Turbopack), React 19.2.4, Drizzle ORM 0.45.2, `drizzle-kit` 0.31.10, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.1 + `@hookform/resolvers` 5.2.2, `@tanstack/react-table` 8.21.3, shadcn/ui 4.1.2, Tailwind CSS 4.2, `sonner` 2.0.7, `lucide-react`, `date-fns` 4.1, `date-fns-tz` 3.2, `react-day-picker`. **Novas dependências (3)**: `@dnd-kit/core` ^6.x, `@dnd-kit/sortable` ^8.x, `@dnd-kit/utilities` ^3.x.
**Storage**: PostgreSQL 16+. Migration única alterando `chapter` (drop `number`, add `title`/`position`) e `book` (add `chapters_version`). Unique index `(book_id, position)` com cláusula `DEFERRABLE INITIALLY DEFERRED` (Drizzle não tem helper nativo — usar `sql\`...\`` na definição do índice ou raw SQL na migration gerada).
**Testing**: Vitest 4 (unit + integration via `BEGIN/ROLLBACK` no banco `audiobook_track_test`) + Playwright (E2E com schema-per-worker em `e2e_w{i}_{uuid8}`).
**Target Platform**: Web app (Next.js server + browser; ambiente macOS/Linux). Suporte mobile-first (sortable funciona com pointer + touch + keyboard).
**Project Type**: Web application — backend (rotas `/api/v1/**`) + frontend (App Router + RSC) em monorepo único `src/`.
**Performance Goals**: Reorder de 50 capítulos < 200 ms p95 server-side (uma transação com 50 UPDATEs em coluna indexada). Render da tabela de `/books/:id` após reorder ≤ 100 ms (mutação otimista + invalidação seletiva). Add chapter < 100 ms p95.
**Constraints**: Cardinalidade típica ≤ 50 capítulos por livro. Concorrência detectada via `book.chapters_version` (sem ETag/If-Match HTTP). Idioma server-side: títulos default em PT-BR (`Capítulo N`, `Prólogo`, etc.); strings literais em código TypeScript. Sem mudanças no schema das outras entidades.
**Scale/Scope**: Produção atual ~ dezenas de livros, centenas de capítulos. Dimensionado para ordem de magnitude acima sem reestruturação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Avaliado contra os 16 princípios da [constitution.md](../../.specify/memory/constitution.md):

| # | Princípio | Aderência | Notas |
|---|---|---|---|
| I | Capítulo como unidade de trabalho | ✅ | `title` e `position` moram no capítulo. `book.chapters_version` é metadado de concorrência, não cálculo. `book.status` continua sendo cache recomputado pelo `BookStatusRecomputeService`. |
| II | Precisão financeira | ✅ | Nenhuma alteração no cálculo: `edited_seconds`, `price_per_hour_cents`, fórmula `round(seconds × price / 3600)`. Título e posição não entram em cálculo nenhum. |
| III | Integridade do ciclo de vida do capítulo | ✅ | Nenhuma transição de status muda. `paid` continua bloqueando os mesmos campos + agora `title`. Reorder não toca status. |
| IV | Simplicidade (YAGNI) | ✅ | Posição densa (não lexorank). Template é constante TypeScript (não tabela). Sem histórico/auditoria de mudanças. Sem importação CSV. Sem clonagem. |
| V | TDD obrigatório | ✅ | Plano de testes coberto em Phase 1 (data-model.md + quickstart.md). Helpers puros (`next-chapter-title`, `normalize-positions`) com 100% de cobertura. |
| VI | Arquitetura limpa no backend | ✅ | Mudanças por camada: schema → domain → ports → adapters → service → factory → route. `withApiErrorHandler` envolve as rotas novas. `apiFetch` consome no cliente. |
| VII | Frontend: composição, atomicidade, mobile-first | ✅ | Componentes em `src/components/features/chapters/` e `src/components/features/books/`. Lógica de drag-and-drop e de chamada de API em hooks co-localizados. Componentes só renderizam JSX + chamam hook. Drag e teclado equivalentes (botões ↑/↓). |
| VIII | Performance | ✅ | Reorder: 1 transação, ≤ 50 UPDATEs em coluna indexada. Mutação otimista no cliente com rollback em erro. Sem N+1 nas listagens. |
| IX | Design tokens | ✅ | Drag handle, hover de linha sortable, e botões ↑/↓ usam tokens (`bg-muted`, `text-muted-foreground`). Dark mode coberto. |
| X | Padrões de API REST | ✅ | Plural kebab-case; `POST /chapters` (201), `PUT /chapters/order` (200), `PATCH /chapters/:id` (200), `409` para conflito de versão e estado, `422` para validação. Envelope padrão de erro. |
| XI | PostgreSQL e banco | ✅ | Unique `(book_id, position)` deferrable. Check `position >= 0`. Check `length(title) <= 100`. Migration reversível via Drizzle (`generate` + `migrate`). FK `chapter.book_id` mantém índice. Sem `SELECT *`. Sem `drizzle-kit push`. |
| XII | Anti-padrões proibidos | ✅ | Sem `any`, sem `console.log`, sem mutação, sem `useEffect` para derivar estado, sem `fetch` em client component (consumo via `apiFetch` em hook), sem `_components/` dentro de `app/`. `useState` apenas para estado visual local do drag overlay. |
| XIII | Métricas/KPIs do dashboard | ✅ | Não tocado. |
| XIV | Visualização de PDF do livro | ✅ | Não tocado. |
| XV | Ferramentas/skills obrigatórias | ✅ | Context7 MCP consultado para `@dnd-kit/sortable` + `drizzle-orm DEFERRABLE` antes do code (research.md). design.pen consultado para drag handle, botões ↑/↓ e dialog "+ Adicionar capítulo" antes da UI. |
| XVI | Qualidade e verificação | ✅ | Fase final: `bun run lint && test:unit && test:integration && test:e2e && build`. Cobertura ≥ 80% (100% nos helpers puros). |

**Resultado do gate**: PASS sem ressalvas. Nenhuma violação justificada — seção Complexity Tracking permanece vazia.

## Project Structure

### Documentation (this feature)

```text
specs/026-chapter-titles-reordering/
├── plan.md                                       # Este arquivo
├── research.md                                   # Phase 0 — decisões técnicas, libs, padrões
├── data-model.md                                 # Phase 1 — schema, domínio, invariantes, índices
├── quickstart.md                                 # Phase 1 — walkthrough manual + plano de testes
├── contracts/
│   ├── api-chapters-create.md                    # POST /api/v1/books/:bookId/chapters
│   ├── api-chapters-order.md                     # PUT  /api/v1/books/:bookId/chapters/order
│   ├── api-chapter-update.md                     # PATCH /api/v1/chapters/:id (estende com title)
│   ├── api-book-create.md                        # POST /api/v1/books (estende com extras)
│   ├── api-book-update.md                        # PATCH /api/v1/books/:id (remove numChapters)
│   ├── lib-next-chapter-title.md                 # helper puro para "próximo Capítulo N"
│   ├── lib-normalize-positions.md                # helper puro para densificar posições
│   ├── lib-chapter-templates.md                  # catálogo client-side
│   ├── ui-add-chapter-dialog.md                  # Dialog "+ Adicionar capítulo"
│   ├── ui-chapters-sortable-table.md             # tabela sortable + handle + botões ↑/↓
│   ├── ui-book-create-extras-section.md          # seção "Extras" no diálogo de criação
│   └── ui-book-edit-dialog.md                    # remoção do ChapterCountInput
├── checklists/
│   └── requirements.md                           # Gerado em /speckit-specify
└── tasks.md                                      # Phase 2 (gerado por /speckit-tasks)
```

### Source Code (repository root)

Mudanças incrementais — sem reorganização estrutural. As alterações tocam dezessete arquivos existentes e criam aproximadamente vinte arquivos novos (incluindo testes).

```text
src/
├── app/
│   ├── (authenticated)/
│   │   └── books/
│   │       └── [id]/page.tsx                                            # Adiciona botão "+ Adicionar capítulo"
│   └── api/v1/
│       ├── books/
│       │   ├── route.ts                                                 # POST estendido (chaptersInput: numbered + extras)
│       │   └── [id]/
│       │       ├── route.ts                                             # PATCH: remove numChapters; bumpa version implicitamente via service
│       │       └── chapters/
│       │           ├── route.ts                                         # NOVO: POST cria capítulo (numerado/template/personalizado)
│       │           ├── order/route.ts                                   # NOVO: PUT reorder com expectedVersion
│       │           └── bulk-delete/route.ts                             # Existente; service bumpa version
│       └── chapters/[id]/route.ts                                       # PATCH estendido (title); DELETE bumpa version via service
├── lib/
│   ├── api/
│   │   ├── error-codes/
│   │   │   ├── chapter.ts                                               # +CHAPTER_TITLE_INVALID, +CHAPTER_TITLE_PAID_LOCKED já coberto por CHAPTER_PAID_LOCKED (extender msg)
│   │   │   └── book.ts                                                  # +BOOK_CHAPTERS_VERSION_CONFLICT
│   │   └── api-fetch.ts                                                 # (sem mudança; já trata 409)
│   ├── db/schema/
│   │   ├── chapter.ts                                                   # -number, +title, +position, novos índices/checks
│   │   └── book.ts                                                      # +chaptersVersion
│   ├── domain/
│   │   ├── chapter.ts                                                   # +title em tipo Chapter; PAID_LOCKED_FIELDS += "title"
│   │   ├── chapter-title.ts                                             # NOVO: validateTitle, normalizeTitle (trim + reject \n/\r)
│   │   ├── chapter-templates.ts                                         # NOVO: CHAPTER_TEMPLATES catálogo + tipos
│   │   ├── next-chapter-title.ts                                        # NOVO: helper puro "próximo Capítulo N"
│   │   ├── normalize-positions.ts                                       # NOVO: helper puro garantindo densidade 0..N-1
│   │   └── book.ts                                                      # +chaptersVersion em tipo Book
│   ├── schemas/
│   │   ├── chapter.ts                                                   # +title em updateChapterSchema; novo createChapterSchema; reorderChaptersSchema
│   │   └── book.ts                                                      # POST estendido com extras: numbered count + extras array
│   ├── repositories/
│   │   ├── chapter-repository.ts                                        # +title/position em Insert/Update; +reorder(bookId, orderedIds, tx); insertMany pluralizado
│   │   ├── book-repository.ts                                           # +bumpChaptersVersion(bookId, tx); +chaptersVersion em retornos
│   │   └── drizzle/
│   │       ├── drizzle-chapter-repository.ts                            # implementa reorder; orderBy position; insert respeita position
│   │       └── drizzle-book-repository.ts                               # implementa bumpChaptersVersion
│   ├── services/
│   │   ├── chapter-service.ts                                           # +createChapter, +reorderChapters; title em update; bump version em todas mutações
│   │   ├── book-service.ts                                              # create: aceita estrutura "chaptersInput" (numbered + extras); update: remove numChapters
│   │   └── book-status-recompute.ts                                     # +bumpa chapters_version dentro da mesma tx
│   ├── factories/
│   │   ├── book-service.ts                                              # sem mudança (deps idênticas)
│   │   └── chapter-service.ts                                           # sem mudança
│   └── errors/
│       ├── chapter-errors.ts                                            # +ChapterTitleInvalidError
│       └── book-errors.ts                                               # +BookChaptersVersionConflictError
├── components/
│   ├── ui/                                                              # sem novos primitivos shadcn
│   └── features/
│       ├── books/
│       │   ├── book-create-dialog.tsx                                   # adiciona seção "Extras"
│       │   ├── book-edit-dialog.tsx                                     # remove ChapterCountInput + reduceHint
│       │   ├── book-detail-client.tsx                                   # adiciona botão "+ Adicionar capítulo"
│       │   ├── chapter-count-input.tsx                                  # mantido (usado em criação para "numerados")
│       │   ├── book-extras-input.tsx                                    # NOVO: lista de extras no diálogo de criação
│       │   └── hooks/
│       │       ├── use-create-book-form.ts                              # +chaptersInput estruturado (numbered + extras)
│       │       └── use-edit-book-form.ts                                # remove campo numChapters
│       └── chapters/
│           ├── chapters-table.tsx                                       # envolve em DndContext + SortableContext
│           ├── chapter-row.tsx                                          # adiciona drag handle + botões ↑/↓
│           ├── chapter-row-edit-mode.tsx                                # +campo title
│           ├── add-chapter-dialog.tsx                                   # NOVO: seletor tipo + posição
│           ├── chapter-title-cell.tsx                                   # NOVO: célula exibe title (substitui "Capítulo N")
│           └── hooks/
│               ├── use-chapters-reorder.ts                              # NOVO: estado otimista + apiFetch PUT order
│               ├── use-add-chapter.ts                                   # NOVO: mutação add chapter
│               ├── use-chapter-row-edit.ts                              # +title no formulário
│               └── use-chapters-table.ts                                # passa orderedIds e dispara reorder

__tests__/
├── unit/
│   ├── lib/domain/
│   │   ├── chapter-title.spec.ts                                        # NOVO: validate trim, max 100, reject \n/\r, empty
│   │   ├── next-chapter-title.spec.ts                                   # NOVO: padrão "Capítulo N", ignora templates, max+1
│   │   ├── normalize-positions.spec.ts                                  # NOVO: densificação 0..N-1
│   │   └── chapter.spec.ts                                              # estende PAID_LOCKED_FIELDS test
│   ├── lib/schemas/
│   │   ├── update-chapter.spec.ts                                       # +title
│   │   ├── create-chapter.spec.ts                                       # NOVO: posição enum + after-id
│   │   ├── reorder-chapters.spec.ts                                     # NOVO: orderedIds + expectedVersion
│   │   └── create-book.spec.ts                                          # +chaptersInput shape
│   └── components/features/chapters/hooks/
│       ├── use-chapters-reorder.spec.tsx                                # NOVO: mutação otimista + rollback
│       └── use-add-chapter.spec.tsx                                     # NOVO
├── integration/
│   ├── repositories/
│   │   ├── drizzle-chapter-title-position.spec.ts                       # NOVO: insert com title+position, listByBookId ordenado por position
│   │   └── drizzle-chapter-reorder.spec.ts                              # NOVO: reorder atômico, densidade preservada, DEFERRABLE funciona
│   └── services/
│       ├── chapter-service-title.spec.ts                                # NOVO: title em update; paid lock; trim/length/newline
│       ├── chapter-service-create.spec.ts                               # NOVO: insere no início/fim/depois-de-X; bumpa version
│       ├── chapter-service-reorder.spec.ts                              # NOVO: reorder OK; reorder com paid OK; conflict version → 409
│       └── book-service-create-with-extras.spec.ts                      # NOVO: criação atômica com numbered + extras
└── e2e/
    └── chapter-titles-and-reorder.spec.ts                               # smoke: criar livro com extras, renomear, arrastar, recarregar

drizzle/migrations/
└── 0008_chapter_title_position_book_version.sql                         # gerado por drizzle-kit + ajustes manuais (DEFERRABLE)
```

**Structure Decision**: mantida a estrutura monorepo do projeto. Não há justificativa para extrair subprojeto ou serviço — a feature é uma evolução pontual do domínio `chapter` com ramificações pequenas em `book` e na UI.

## Complexity Tracking

> Não há violações da constituição. Seção vazia intencionalmente.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

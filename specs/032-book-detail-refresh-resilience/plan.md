# Implementation Plan: Resiliência de Refresh no Detalhe do Livro + Skeleton de Carregamento do Detalhe

**Branch**: `032-book-detail-refresh-resilience` | **Date**: 2026-06-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/032-book-detail-refresh-resilience/spec.md`

## Summary

Tornar o fluxo de criação de capítulo no detalhe do livro **resiliente a refresh** (criação otimista + token de versão devolvido pelos contratos de mutação) para então **restaurar com segurança** o estado de carregamento de rota (`loading.tsx`) do detalhe — revertido na 031 por causa do bug [vercel/next.js#86151](https://github.com/vercel/next.js/issues/86151) (o `router.refresh()` trava de forma intermitente quando o segmento tem `loading.tsx`).

Abordagem técnica (validada contra o código existente):

1. **Criação otimista** — o POST `/books/:id/chapters` já devolve `{ chapter, bookStatus, chaptersVersion }`. Repassar o capítulo no `onCreated`, inseri-lo em `state.chapters` na posição retornada e re-densificar `0..N-1` no cliente (reuso de `densifyPositions`). O `router.refresh()` permanece apenas como re-sync em background (FR-004), alinhando ao padrão dos fluxos irmãos.
2. **Token nos contratos de mutação** — `update()`/`delete()`/`bulkDelete()` já computam o novo `chaptersVersion` via `recomputeBookStatusAndBumpVersion`, mas o descartam. Propagá-lo: PATCH adiciona `meta.chaptersVersion`; DELETE e bulk-delete (que mantêm `204`) adicionam o header `X-Chapters-Version` (mesmo padrão do `X-Book-Deleted` existente). A UI re-sincroniza o token localmente, removendo a dependência do refresh.
3. **Recuperação de conflito sem refresh** — `handleChaptersConflict` passa a re-sincronizar via `GET /api/v1/books/:id` (endpoint que **já existe** e devolve o detalhe completo + `chaptersVersion`), em vez de `router.refresh()`.
4. **Restaurar `loading.tsx`** do detalhe + o bloco de teste unitário `"/books/[id] loading state"` (ambos preservados no commit `d4154de`). A listagem vive em `books/(list)/`; o loading do detalhe entra em `books/[id]/`.
5. **Ajustar 2 specs E2E** afetados pelo streaming: `books-detail.spec.ts` (404 → assert da UI `not-found-message`, pois sob streaming o shell responde HTTP 200) e `chapters-table-scroll.spec.ts` (aguardar visibilidade da 1ª linha antes de medir alturas).

**Sem mudança de schema, migration, repository ou domínio puro.** Sem novas dependências. Evidência de aceite: `chapter-reorder-then-add.spec.ts` verde em 10 execuções consecutivas **com** o `loading.tsx` do detalhe presente.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router, convenção `loading.tsx`, streaming/Suspense, `router.refresh`), React 19.2.4, react-hook-form, Zod, shadcn/ui (`Skeleton`), Tailwind CSS 4.2, lucide-react. **Nenhuma dependência nova** (FR-009).

**Storage**: PostgreSQL via Drizzle ORM — **sem mudança de schema nem migration nesta feature** (apenas propagação de um valor já computado).

**Testing**: Vitest (unit com jsdom + integration com DB real via BEGIN/ROLLBACK), Playwright (E2E schema-per-worker).

**Target Platform**: Web (Next.js full-stack, SSR + Server Components por padrão).

**Project Type**: web — frontend e backend no mesmo projeto Next.js (`src/app`, `src/components`, `src/lib`).

**Performance Goals**: LCP < 1s (Princípio VIII). O `loading.tsx` melhora a performance percebida (elimina tela em branco); CLS < 0.1 mantido pela silhueta estruturada.

**Constraints**: Bug upstream #86151 — `router.refresh()` trava de forma intermitente quando o segmento tem `loading.tsx`; a probabilidade cresce com a complexidade da página e a velocidade da conexão. O design **não pode** depender do refresh como caminho crítico para o capítulo aparecer ou para o token re-sincronizar.

**Scale/Scope**: 1 rota afetada (`/books/[id]`); ~6 arquivos de produção tocados (1 service, 2 route handlers, 3–4 hooks de feature, 1 `loading.tsx` restaurado); ~4 arquivos de teste (1 unit restaurado/estendido, 1–2 integration, 1 E2E de aceite + 2 E2E ajustados).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|---|---|---|
| **I. Capítulo como unidade** | Criação otimista opera no nível do capítulo; `book.status` continua recomputado por `recomputeBookStatusAndBumpVersion` na mesma transação (inalterado). A UI apenas reflete o status devolvido. | ✅ |
| **II. Precisão financeira (NÃO NEGOCIÁVEL)** | Capítulo criado é `pending` com `editedSeconds = 0` → zero impacto em ganho. Nenhuma alteração na fórmula nem em `lib/domain/earnings.ts`. Otimismo reflete **apenas** o que o servidor confirmou. **Revisão dupla obrigatória** (toca fluxos de capítulo — governança). | ✅ (flag revisão dupla) |
| **III. Ciclo de vida** | Nenhuma transição nova; capítulo criado entra em `pending`. State machine intocada. | ✅ |
| **IV. Simplicidade (YAGNI)** | Propaga um valor já computado; reusa `densifyPositions` e o `GET /books/:id` existente — **nenhum endpoint novo**. Restaura código já escrito (`d4154de`). | ✅ |
| **V. TDD** | Testes antes: unit (insert otimista + densify, resync por GET, bump de token, render do `loading.tsx`), integration (PATCH/DELETE/bulk-delete devolvem token), E2E (aceite + 2 ajustes). Cobertura ≥ 80%; earnings 100% inalterado. | ✅ |
| **VI. Clean Architecture** | Route handlers continuam finos; lógica de token já está no service (só propaga no result type). Sem lógica de negócio no controller. | ✅ |
| **VII. Frontend apresentacional** | Toda lógica nova vive em hooks co-localizados (`use-book-detail`, `use-add-chapter`, `use-delete-chapter`, `use-chapter-row-edit`). `loading.tsx` é Server Component (sem `use client`). Componentes só renderizam. | ✅ |
| **VIII. Performance** | `loading.tsx` melhora percepção; sem peso novo de bundle; lazy já presente. | ✅ |
| **IX. Design tokens** | `Skeleton` e layout usam tokens semânticos (dark mode por construção). | ✅ |
| **X. API REST** | DELETE permanece `204` (Princípio X) com metadado em header `X-Chapters-Version` (padrão do `X-Book-Deleted`). PATCH mantém envelope `{ data, meta }` + `meta.chaptersVersion`. Zod e status codes inalterados. | ✅ |
| **XI. PostgreSQL** | Sem schema novo, sem `SELECT *`, sem FK nova, sem migration. Token continua bumpado em transação única. | ✅ |
| **XII. Anti-padrões** | `router.refresh()`/`apiFetch`/`fetch` permanecem em hooks (nunca em componente client). Sem `useState` de domínio em componente. Sem `toast.success`. Sem `any` injustificado. | ✅ |
| **XV. Skills/Context7** | Context7 consultado para Next.js (streaming/`loading.tsx`/`notFound`) — confirma HTTP 200 sob streaming. `design.pen` consultado para a silhueta do detalhe. | ✅ |
| **XVI. Verificação final** | `bun run lint` + `test:unit` + `test:integration` + `test:e2e` + `build` na fase final. | ✅ |

**Resultado**: Sem violações. Nenhuma entrada em Complexity Tracking. Flag de governança: **revisão dupla** antes do merge (mudança em fluxos de capítulo).

## Project Structure

### Documentation (this feature)

```text
specs/032-book-detail-refresh-resilience/
├── plan.md              # Este arquivo (/speckit-plan)
├── research.md          # Phase 0 (/speckit-plan)
├── data-model.md        # Phase 1 (/speckit-plan)
├── quickstart.md        # Phase 1 (/speckit-plan)
├── contracts/           # Phase 1 (/speckit-plan)
│   ├── chapter-mutation-contracts.md
│   └── book-detail-loading.md
├── checklists/
│   └── requirements.md  # Criado por /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── (authenticated)/books/[id]/
│   │   ├── page.tsx                       # (existente) já chama notFound() pós-fetch
│   │   └── loading.tsx                    # NOVO (restaurado de d4154de) — FR-007/008
│   └── api/v1/
│       ├── books/[id]/
│       │   ├── route.ts                   # (existente) GET já devolve detalhe completo (resync de conflito)
│       │   └── chapters/
│       │       ├── route.ts               # (existente) POST já devolve chapter+bookStatus+chaptersVersion
│       │       └── bulk-delete/route.ts   # EDIT — adicionar header X-Chapters-Version
│       └── chapters/[id]/route.ts         # EDIT — PATCH: meta.chaptersVersion; DELETE: header X-Chapters-Version
├── lib/services/
│   └── chapter-service.ts                 # EDIT — adicionar chaptersVersion a Update/Delete/BulkDelete result types
└── components/features/
    ├── books/
    │   ├── book-detail-client.tsx         # (talvez) ajustar wiring de callbacks
    │   └── hooks/use-book-detail.ts       # EDIT — insert otimista + densify; bump de token em saved/deleted/bulk; resync por GET no conflito
    └── chapters/hooks/
        ├── use-add-chapter.ts             # EDIT — repassar o chapter criado no onCreated
        ├── use-chapter-row-edit.ts        # EDIT — ler meta.chaptersVersion; repassar no onSaved
        └── use-delete-chapter.ts          # EDIT — ler header X-Chapters-Version; repassar no onDeleted

__tests__/
├── unit/
│   ├── app/route-loading-states.spec.tsx # EDIT — restaurar describe "/books/[id] loading state"
│   └── components/features/books/...      # NOVO/EDIT — testes de hook (insert otimista, resync, bump)
├── integration/
│   └── api/chapters/...                   # NOVO/EDIT — PATCH/DELETE/bulk-delete devolvem token
└── e2e/
    ├── chapter-reorder-then-add.spec.ts   # (aceite) verde 10× COM loading.tsx — SC-001
    ├── books-detail.spec.ts               # EDIT — 404 via UI not-found-message (streaming → HTTP 200)
    └── chapters-table-scroll.spec.ts      # EDIT — aguardar visibilidade da 1ª linha antes de medir
```

**Structure Decision**: Projeto web Next.js de projeto único (não monorepo). A feature segue a Clean Architecture já estabelecida (route handlers finos → service → repository) e o padrão de componente apresentacional + hook co-localizado (Princípio VII). Os caminhos reais acima foram confirmados por leitura do código existente. Nenhuma pasta nova é criada; apenas um arquivo de produção novo (`books/[id]/loading.tsx`, restaurado do histórico).

## Complexity Tracking

> Sem violações constitucionais. Nenhuma justificativa de complexidade necessária.

Nenhuma. A feature reduz complexidade implícita (remove a dependência frágil do `router.refresh()` como caminho crítico) sem adicionar abstrações, endpoints ou dependências.

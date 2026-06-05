# Implementation Plan: Skeletons de Carregamento nas Rotas Autenticadas

**Branch**: `031-route-loading-skeletons` | **Date**: 2026-06-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/031-route-loading-skeletons/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Eliminar a tela em branco nas 6 rotas autenticadas que fazem fetch server-side (`/books`, `/books/[id]`, `/narrators`, `/editors`, `/studios`, `/settings`) adicionando `loading.tsx` por rota, com abordagem **híbrida**: moldura estática real (título, descrição, botão de ação e busca desabilitados) + bloco único de skeleton na região dependente de dados. Um componente compartilhado em `components/layout/` cobre as 4 listagens; detalhe do livro e configurações compõem inline nos seus `loading.tsx`. O primitivo `Skeleton` ganha `motion-reduce:animate-none` (a11y, beneficia o dashboard). Anúncio acessível via `role="status"` + texto sr-only. Zero dependências novas, zero JS de cliente adicional (tudo Server Component estático, pré-buscado pelo Next.js junto aos `<Link>`s).

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Bun 1.2 (runtime + package manager + test runner)

**Primary Dependencies**: Next.js 16.2.1 (App Router, convenção `loading.tsx`), React 19.2.4, shadcn/ui (primitivos `Skeleton`, `Button`, `Input`, `Card`), Tailwind CSS 4.2 (variant `motion-reduce:`), lucide-react (ícones `Plus`/`Search` da moldura). **Nenhuma dependência nova** (FR-006).

**Storage**: N/A — feature puramente de apresentação; nenhuma mudança de schema, repository ou service.

**Testing**: Vitest 4 + `@testing-library/react` (jsdom via pragma `// @vitest-environment jsdom`) para render tests; Playwright para 1 E2E determinístico com interceptação de rede atrasando o fetch RSC (servidor `next start` de produção, padrão schema-per-worker existente).

**Target Platform**: Web (Next.js App Router, SSR/streaming), desktop e mobile (mobile-first).

**Project Type**: Web application (Next.js full-stack) — apenas camada de apresentação é tocada.

**Performance Goals**: Feedback visual percebido como instantâneo na navegação (loading UI pré-buscada com os Links em produção — confirmado na doc do Next.js); zero bytes adicionais de JS no cliente (loading files são Server Components estáticos); LCP < 1s preservado (Princípio VIII).

**Constraints**: Sem bibliotecas novas (FR-006); apenas tokens semânticos (FR-003); moldura idêntica entre estado de loading e página real para CLS < 0.1 (FR-004/SC-003); blocos decorativos fora da árvore de acessibilidade + anúncio único de status (FR-008); sem animação sob `prefers-reduced-motion` (FR-009).

**Scale/Scope**: 6 rotas, 1 componente compartilhado novo, 1 edição de primitivo (1 linha), ~3 arquivos de teste. Sem impacto em domínio, API ou banco.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Status |
|-----------|-----------|--------|
| I. Capítulo como unidade | N/A — nenhuma operação de domínio | ✅ |
| II. Precisão financeira | N/A — nenhum cálculo financeiro | ✅ |
| III. Ciclo de vida do capítulo | N/A — nenhuma transição de status | ✅ |
| IV. Simplicidade (YAGNI) | 1 componente compartilhado para 4 rotas idênticas; detalhe/settings inline no próprio `loading.tsx` (sem abstração especulativa); bloco único em vez de réplica linha-a-linha | ✅ |
| V. TDD + classificação de testes | Render tests = **unit** (jsdom, sem `vi.mock`, componentes puros); navegação real = **E2E** (Playwright). RED→GREEN→REFACTOR com checkpoint commits (skill `/tdd`). Cobertura ≥ 80% no componente novo | ✅ |
| VI. Arquitetura limpa backend | N/A — backend intocado | ✅ |
| VII. Frontend: composição e apresentação | `loading.tsx` são Server Components **puramente de renderização** (zero hooks, zero estado — nem visual); compõem `components/ui/` (`Skeleton`, `Button`, `Input`, `Card`) e `components/layout/` (`PageContainer`, `PageHeader`, `PageTitle`, `PageDescription`); componente compartilhado em `components/layout/` (usado por ≥ 2 features, mesmo critério do `page-container.tsx`); **nenhum** componente em pasta dentro de `src/app/` (composição inline no próprio arquivo de convenção `loading.tsx` é permitida, como em `page.tsx`); HTML cru apenas onde não há primitivo (`<span>` sr-only); mobile-first (larguras fluidas, mesmos breakpoints da moldura real) | ✅ |
| VIII. Performance | Zero JS de cliente adicionado; loading UI pré-buscada; melhora performance **percebida** sem custo de bundle | ✅ |
| IX. Design tokens | Apenas tokens semânticos (`bg-muted` do primitivo); nenhuma cor/espaçamento hardcoded | ✅ |
| X. API REST | N/A — nenhuma rota de API | ✅ |
| XI. PostgreSQL | N/A — nenhuma query | ✅ |
| XII. Anti-padrões | Nenhum: sem `any`, sem `useEffect`, sem estado, sem toast, sem `_components/` | ✅ |
| XV. Ferramentas | Context7 consultado (semântica `loading.tsx`/prefetch no Next.js 16 — ver research.md); `design.pen` não exigido (nenhuma tela nova — a linguagem visual deriva do `SectionSkeleton` do dashboard e da moldura real de cada página existente) | ✅ |
| XVI. Verificação final | Fase final única antes do PR: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`, `bun run build` | ✅ |

**Resultado**: PASS — nenhuma violação; Complexity Tracking vazio.

**Skills de referência aplicadas** (input do usuário):

- **/frontend-design**: o estado de carregamento é tratado como "load sequence" intencional — uma direção única (moldura real + bloco pulsante) executada de forma coerente nas 6 rotas, preservando o design system existente em vez de inventar linguagem nova; motion com propósito (pulse = "dados a caminho"), nunca decorativa.
- **/frontend-patterns**: composição sobre configuração (`ListPageLoading` compõe `PageContainer`/`PageHeader`/primitivos via props mínimas de conteúdo); Server Components como padrão; nenhum estado/efeito em componente de apresentação.
- **/tdd**: testes de render escritos primeiro (RED), implementação mínima (GREEN), refactor com testes verdes; checkpoint commits por estágio (`test:` → `feat:`/`fix:` → `refactor:`).

## Project Structure

### Documentation (this feature)

```text
specs/031-route-loading-skeletons/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── loading-states.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── app/(authenticated)/
│   ├── books/
│   │   ├── loading.tsx                    # NEW — <ListPageLoading> com moldura de Livros
│   │   ├── page.tsx                       # EDIT — chamada a applyE2eDataDelay() antes do fetch de dados
│   │   └── [id]/loading.tsx               # NEW — silhueta do detalhe (barras header + bloco)
│   ├── narrators/loading.tsx              # NEW — <ListPageLoading> com moldura de Narradores
│   ├── editors/loading.tsx                # NEW — <ListPageLoading> com moldura de Editores
│   ├── studios/loading.tsx                # NEW — <ListPageLoading> com moldura de Estúdios
│   └── settings/loading.tsx               # NEW — título real + 2 blocos de seção
├── components/
│   ├── layout/
│   │   └── page-loading.tsx               # NEW — ListPageLoading + LoadingStatus (compartilhados)
│   └── ui/
│       └── skeleton.tsx                   # EDIT — adicionar motion-reduce:animate-none (1 linha)
└── lib/
    └── e2e/
        └── data-delay.ts                  # NEW — atraso server-side test-only p/ E2E determinístico (R6)

__tests__/
├── unit/
│   ├── components/layout/page-loading.spec.tsx   # NEW — contrato do componente compartilhado
│   ├── app/route-loading-states.spec.tsx         # NEW — render de cada loading.tsx (6 rotas)
│   └── lib/e2e/data-delay.spec.ts                # NEW — guards e clamp do helper de atraso
└── e2e/
    └── books-loading-skeleton.spec.ts            # NEW — navegação com atraso server-side determinístico
```

**Structure Decision**: Web application Next.js já estabelecida — a feature adiciona apenas arquivos de convenção do App Router (`loading.tsx` por segmento de rota) e um componente de layout compartilhado. `books/` e `books/[id]/` exigem arquivos separados porque são segmentos aninhados com estruturas distintas (listagem vs detalhe). O componente compartilhado vive em `src/components/layout/` (não em `features/`) porque atende 4 features distintas — mesmo critério que posiciona `page-container.tsx` lá. Detalhe do livro e settings compõem inline nos seus `loading.tsx` (estruturas únicas, sem reuso — YAGNI).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*Sem violações — tabela não aplicável.*

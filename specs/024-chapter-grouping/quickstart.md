# Quickstart — 024 Chapter Grouping

**Feature**: Agrupamento de capítulos por editor/narrador/status na tabela do livro
**Audience**: Dev implementando a feature.
**Pre-reqs**: Branch `024-chapter-grouping` checked out; `bun install` rodado; banco local com dados de teste (`bun run db:seed` + `bun run db:seed:test` se for rodar E2E).

---

## 1. Sequência de implementação (alto-nível)

A ordem abaixo segue TDD por user story; cada bloco é um sub-PR commit-friendly. Detalhes finos em `tasks.md` (gerado por `/speckit-tasks`).

```
┌─────────────────────────────────────────────────────────────────┐
│ M0 — Migrar chapters-table para TanStack Table (refator puro)   │
│      Sem mudança de UX. Confirma que todos os E2E atuais passam.│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M1 — Domain: funções de agregação + parser de URL               │
│      lib/domain/chapter-aggregation.ts                          │
│      lib/utils → formatGroupedSeconds                           │
│      Unit tests TDD (100% coverage nas agregações)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M2 — Hook useChaptersGroupingState (URL ↔ GroupingState)        │
│      Unit tests via renderHook                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M3 — Feature flag config                                        │
│      lib/config/feature-flags.ts                                │
│      Default: SHOW_EARNINGS_IN_NARRATOR_GROUPS = true           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M4 — Componente ChapterGroupingControl (P1)                     │
│      shadcn DropdownMenu + DropdownMenuCheckboxItem             │
│      Hook controla apenas estado visual interno; props para     │
│      grouping + onGroupingChange                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M5 — ChapterGroupRow component (P1)                             │
│      Linha-resumo com aggregatedCell renderers                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M6 — Wire-up em ChaptersTable (P1 — Stories 1 e 2)              │
│      Colunas com enableGrouping; sort fn custom (unassigned     │
│      last); render hybrid (group row vs ChapterRow)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M7 — Story 3: agrupar por status (mesma infraestrutura)         │
│      Apenas adiciona dimensão; breakdown collapse quando        │
│      grouping = status no nível                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M8 — Story 4: multi-nível                                       │
│      Validar hierarquia 2-3 níveis com tests E2E                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M9 — Story 5: aplicar feature flag na renderização              │
│      ChapterGroupRow gate, garante outras dimensões intactas    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ M10 — Verificação final                                         │
│      bun run lint, test:unit, test:integration, test:e2e, build │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Setup local rápido

```fish
# Já na branch
git status

# Dev server (Turbopack)
bun run dev

# Em outro terminal, watch dos testes unitários
bun run test:unit --watch
```

Rota afetada: `http://localhost:3000/books/<algum-id>`.

Para encontrar um id válido localmente:
```fish
bun run db:seed  # se ainda não rodou
# em http://localhost:3000/books pegar qualquer livro com 5+ capítulos
```

---

## 3. Validação manual (smoke)

Após cada milestone:

1. **Após M0 (migração)**: `/books/<id>` continua renderizando exatamente como antes. Headers de coluna agora têm sort (visível). Nenhum E2E existente quebra.
2. **Após M6 (P1)**: Trigger "Agrupar por" aparece acima ou ao lado do header da tabela. Clicar em "Editor" agrupa; soma de minutos/ganho está correta; "Sem atribuição" no fundo.
3. **Após M8 (P2)**: `?groupBy=narrator,editor` na URL ativa hierarquia. Click em "Narrador" depois em "Editor" reproduz o mesmo estado.
4. **Após M9 (P3)**: Mudar `SHOW_EARNINGS_IN_NARRATOR_GROUPS` para `false` em `feature-flags.ts` → reload → grupo de narrador não mostra ganho; grupos de editor/status continuam mostrando.

---

## 4. Comandos chave

```fish
# Linting + format check
bun run lint

# Unit + integration
bun run test:unit
bun run test:integration

# E2E (heavy — só na fase final ou quando suspeitar de regressão E2E)
bun run test:e2e

# Build de produção
bun run build
```

**Regra do projeto**: SEMPRE scripts do `package.json`, nunca comandos diretos (`bunx biome`, `next build`, etc.).

---

## 5. Onde rodar cada teste

| Teste | Comando | Local |
|---|---|---|
| `chapter-aggregation.spec.ts` (unit) | `bun run test:unit` | `__tests__/unit/lib/domain/` |
| `grouping-param.spec.ts` (unit) | `bun run test:unit` | `__tests__/unit/lib/url/` ou similar |
| `use-chapters-grouping-state.spec.tsx` (unit) | `bun run test:unit` | `__tests__/unit/components/features/chapters/hooks/` |
| `format-grouped-seconds.spec.ts` (unit) | `bun run test:unit` | `__tests__/unit/lib/format/` |
| `chapters-grouping.spec.ts` (E2E) | `bun run test:e2e` | `__tests__/e2e/` |

---

## 6. Pontos de atenção (gotchas)

- **Não confundir `narrator_id`/`editor_id` strings com `__unassigned__`**. Use o sentinel apenas no accessor de TanStack; nunca grave em domain entities.
- **Arredondar earnings POR CAPÍTULO** antes de somar. Princípio II da constituição: somar segundos e depois aplicar a fórmula viola auditabilidade.
- **`router.replace(..., { scroll: false })`** — sem `scroll: false`, o agrupamento dispara scroll-to-top no Next 16.
- **Não migrar `ChapterRow` para `flexRender`** — render leaves via `<ChapterRow chapter={row.original}>` para preservar modos view/edit existentes.
- **Bun runtime obrigatório nos comandos** (não `npx`, sempre `bunx --bun`).
- **shadcn DropdownMenu**: se faltar em `components/ui/`, rodar `bunx --bun shadcn@latest add dropdown-menu`. NUNCA escrever do zero.
- **Status enum em PT-BR**: usar o helper existente `chapterStatusLabel` (ou criar se faltar) em `lib/domain/chapter.ts` para evitar string literals espalhadas.

---

## 7. Critério de "feito"

A feature está pronta quando:

1. ✅ Todos os 5 acceptance scenarios da spec (Stories 1-5) passam manualmente.
2. ✅ `bun run lint` → zero warnings.
3. ✅ `bun run test:unit` → todos os novos tests passam; cobertura ≥ 80% no diff.
4. ✅ `bun run test:integration` → todos verdes (nenhum teste novo aqui).
5. ✅ `bun run test:e2e` → 5 novos cenários (1 por story) verdes.
6. ✅ `bun run build` → compila sem erro.
7. ✅ Self-review checklist da constituição (princípios I a XVI) confirmado.
8. ✅ PR rebaseado em `main`, descrição usando `/conventional-commits` e `/pr-description`.

---

## 8. Skills sugeridas durante implementação

| Momento | Skill |
|---|---|
| Buscar API exata do TanStack Table v8 | `/docs` (Context7 — `/tanstack/table`) |
| Adicionar componente shadcn ausente | `/shadcn` |
| Reforçar disciplina de componentes apresentacionais | `/frontend-patterns` |
| TDD por feature | `/tdd` |
| Code review pré-PR | `/code-review` |
| Cobertura E2E | `/e2e` |
| Simplificar após primeiro green | `/simplify` |
| Commits convencionais | `/conventional-commits` |
| Abrir PR | `/finish-task` |

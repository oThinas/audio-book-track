# Phase 0 Research — 024 Chapter Grouping

**Feature**: Agrupamento de capítulos por editor/narrador/status na tabela do livro
**Plan**: [plan.md](./plan.md)
**Date**: 2026-05-13

---

## R-001: A `chapters-table` ainda NÃO usa TanStack Table — migração é pré-requisito

**Decisão**: Antes de adicionar agrupamento, migrar `src/components/features/chapters/chapters-table.tsx` para TanStack Table v8 (igual ao padrão de `books-table`, `studios-table`, `narrators-table`, `editors-table`). A premissa do usuário ("`agrupar` já presente no TanStack Table") é verdadeira para outras tabelas do projeto, mas a tabela de capítulos foi escrita antes desse padrão se consolidar.

**Rationale**:
- A spec assume TanStack Table como motor de agrupamento (intent explícito do usuário). Sem migrar, teríamos que reimplementar grouping/sort/expand manualmente — caminho contra o stack do projeto.
- Migrar agora alinha as 5 tabelas do projeto no mesmo padrão (reduz divergência de manutenção).
- FR-007 (sort do header dentro do grupo) é trivial via `getSortedRowModel`; sem TanStack Table teríamos código de sort handwritten.
- A migração é refatoração pura: nenhum comportamento muda. É feita em commit separado, antes do agrupamento entrar.

**Alternatives considered**:
- **Reimplementar grouping client-side manualmente** (puro JS sobre `chapters[]`): rejeitado — duplica trabalho que a lib já faz, fica fora do padrão de tabelas do projeto, perde sort headers de graça.
- **Manter renderização atual e usar TanStack só para agregação de dados** (rodar `getGroupedRowModel` sem renderizar via TanStack): rejeitado — quebra simetria com outras tabelas; o `flexRender` é o ponto de extensão natural.

**Impact on scope**:
- Esta feature inclui 1 commit de **refatoração** (migrar `chapters-table` para TanStack Table sem mudar UX) + N commits de **feature** (agrupamento por cima).
- Listado em `## Complexity Tracking` no `plan.md`.

---

## R-002: Estratégia híbrida de renderização — TanStack drives state, ChapterRow renders leaves

**Decisão**: Após migração, a `chapters-table` itera `table.getRowModel().rows` e renderiza condicionalmente:
- `row.getIsGrouped()` → renderiza `ChapterGroupRow` (novo componente: célula de label do grupo + células agregadas via `aggregatedCell`).
- Senão (leaf) → renderiza `ChapterRow` existente passando `row.original` como `chapter`.

**Rationale**:
- `ChapterRow` tem 2 modos (view/edit) com inline editing, dialog de delete, modo selection. Reescrever tudo em terms de TanStack `flexRender` quebraria muita coisa que já funciona.
- O hybrid mantém `ChapterRow` intocada. TanStack só nos dá: ordem das linhas (sort + grouping), quem é grupo vs folha, expansão.
- Não há prejuízo de feature: `row.original` carrega a entidade completa, e a `ChapterRow` continua sendo "puramente de renderização" do ponto de vista da nova tabela.

**Alternatives considered**:
- **Migrar `ChapterRow` para `flexRender` puro com cells por coluna**: rejeitado — destruiria a coesão da row (que tem estado interno de view/edit, dialogs, ações). Muito código novo sem ganho funcional.
- **Renderizar tudo via `flexRender` mas manter `ChapterRow` como um único cell que ocupa toda a row**: rejeitado — hack contra o modelo da lib.

---

## R-003: API de agrupamento do TanStack Table v8

**Decisão**: Usar a API estável v8 (instalada: `@tanstack/react-table@^8.21.3`):

```ts
import {
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type GroupingState,
  type ExpandedState,
  type SortingState,
} from "@tanstack/react-table";

const table = useReactTable({
  data: chapters,
  columns,
  state: { grouping, expanded, sorting },
  onGroupingChange: setGrouping,
  onExpandedChange: setExpanded,
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSortedRowModel: getSortedRowModel(),
});
```

**Rationale**: v8 é a versão instalada e estável. O snippet de doc do Context7 que mostra `tableFeatures` + `_features` é de v9-alpha — NÃO usar (ainda não está no pacote). v8 expõe os mesmos conceitos via `getXxxRowModel()` factories.

**Alternatives considered**:
- **Upgrade para v9-alpha**: rejeitado — alpha, sem necessidade.

---

## R-004: Estrutura de colunas e funções de agregação

**Decisão**: Definir colunas do TanStack com IDs estáveis (`narrator`, `editor`, `status`, `editedSeconds`) e configurar:

| Coluna | `enableGrouping` | `accessorFn` | `aggregationFn` | `aggregatedCell` |
|---|---|---|---|---|
| `narrator` | `true` | `row => row.narrator?.id ?? "__unassigned__"` | — | label de grupo |
| `editor` | `true` | idem para editor | — | label de grupo |
| `status` | `true` | `row => row.status` | — | label de grupo (PT-BR) |
| `editedSeconds` | `false` | `row => row.editedSeconds` | `"sum"` (built-in) | minutagem formatada |
| `earnings` (derivada) | `false` | `row => computeChapterEarningsCents(row)` | custom `"sumCentsRounded"` | BRL formatado, gated por feature flag |
| `chapterCount` (derivada) | `false` | `row => 1` | `"sum"` | contagem como inteiro |
| `statusBreakdown` (derivada) | `false` | `row => row.status` | custom `"countByStatus"` | string PT-BR ("3 concluídos · 1 em revisão") |

**Rationale**:
- `accessorFn` mapeia `null` para `"__unassigned__"` (sentinela) para o bucket "Sem atribuição". TanStack agrupa por valor de accessor, então essa transformação é o ponto certo.
- Agregações built-in (`sum`) bastam para minutagem e contagem.
- Agregações custom (`sumCentsRounded`, `countByStatus`) ficam em `lib/domain/chapter-aggregation.ts` (testáveis isoladamente, 100% cobertura).
- Colunas derivadas (`earnings`, `chapterCount`, `statusBreakdown`) NÃO têm `cell` próprio (não aparecem em row de capítulo individual) — apenas `aggregatedCell` que aparece na linha-resumo do grupo.

**Custom aggregation: `sumCentsRounded`**:
```ts
// columnId é "earnings", leafRows são os capítulos folha do grupo
sumCentsRounded: (_columnId, leafRows) => {
  return leafRows.reduce((acc, leaf) => acc + computeChapterEarningsCents(leaf.original), 0);
}
```

**Custom aggregation: `countByStatus`** retorna `Record<ChapterStatus, number>` que o `aggregatedCell` formata em PT-BR.

---

## R-005: Bucket "Sem atribuição" sempre no fim do nível (FR-004, FR-006)

**Decisão**: Custom sortingFn por coluna agrupada que (a) sempre empurra o sentinel `"__unassigned__"` para o fim, (b) ordena os demais por `edited_seconds` desc agregado.

```ts
// Aplica APENAS para a row no nível do grupo (row.getIsGrouped())
function sortGroupsByMinutesWithUnassignedLast(rowA, rowB, columnId) {
  const a = rowA.getValue<string>(columnId);
  const b = rowB.getValue<string>(columnId);
  if (a === "__unassigned__" && b !== "__unassigned__") return 1;
  if (b === "__unassigned__" && a !== "__unassigned__") return -1;
  const minutesA = rowA.getValue<number>("editedSeconds");
  const minutesB = rowB.getValue<number>("editedSeconds");
  return minutesB - minutesA; // desc
}
```

**Rationale**:
- TanStack `getSortedRowModel` ordena em todos os níveis. Aplicar o sortingFn na coluna de grupo (`narrator`/`editor`/`status`) com fallback para `editedSeconds` resolve FR-006 sem dois passes manuais.
- O sentinel `"__unassigned__"` é estável e ordenável por string-compare; o custom fn intercepta antes para garantir a posição.

---

## R-006: Sort do header dentro do grupo (FR-007)

**Decisão**: `getSortedRowModel` aplica em todos os níveis. Para garantir que **headers de colunas não-agrupadas** ordenem **apenas folhas** sem reordenar os grupos:
- Colunas agrupáveis (`narrator`, `editor`, `status`) usam `sortingFn` custom (R-005) que ignora click do header e mantém ordem por minutagem desc.
- Colunas folha (`number`, `editedSeconds`) habilitam `enableSorting: true` normalmente; quando o usuário clica, ordena dentro do grupo.

**Rationale**: A diferença está em qual `sortingFn` cada coluna usa. TanStack permite por-coluna. Default `number` asc é configurado via `state.sorting` inicial.

**Validation**: Test garantido — sort por `editedSeconds` desc reordena folhas dentro de cada grupo, mas grupos continuam por minutagem desc com "Sem atribuição" no fim.

---

## R-007: Estado de agrupamento sincronizado com URL

**Decisão**: Hook `useChaptersGroupingState` lê/escreve `?groupBy=narrator,editor` via `useSearchParams` + `useRouter().replace`:

```ts
function useChaptersGroupingState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const raw = searchParams.get("groupBy");
  const grouping = useMemo(() => parseGroupingParam(raw), [raw]);

  const setGrouping = useCallback((next: GroupingState) => {
    const params = new URLSearchParams(searchParams);
    if (next.length === 0) params.delete("groupBy");
    else params.set("groupBy", next.join(","));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  return { grouping, setGrouping };
}
```

**`parseGroupingParam`** valida (FR-003):
- Divide por `,`.
- Aceita apenas valores em `["narrator", "editor", "status"]`.
- Remove duplicatas (preserva primeira ocorrência).
- Se o resultado for vazio ou diferente do input, retorna `[]` (e o caller normaliza a URL no próximo render).

**Rationale**: Padrão "URL as state" (regras `web/patterns.md`). `router.replace` evita poluir histórico do browser a cada toggle.

---

## R-008: Estado de expansão (FR-008)

**Decisão**: `expanded` mora em `useState<ExpandedState>({})`, do hook `useChaptersTable` (componente da tabela). NÃO é serializado na URL nem persistido. Re-fetches dos capítulos NÃO disparam reset (chave do state é o `useReactTable`, não os dados).

**Rationale**:
- React preserva `useState` entre re-renders enquanto o componente não desmonta. Navegar fora da rota desmonta → estado some → recarregar volta a colapsado (FR-008).
- Mutar `chapters` (re-fetch) não desmonta o componente; expansão sobrevive (Q4 do clarify).

---

## R-009: Controle de agrupamento — primitiva shadcn

**Decisão**: Usar `DropdownMenu` + `DropdownMenuCheckboxItem` (shadcn/ui). Cada dimensão é um checkbox; cliques são processados em sequência; a ordem do array de grouping é a ordem de marcação.

**UX**:
- Botão trigger: `<Button variant="outline">Agrupar por <chevron /></Button>` — quando há agrupamento ativo, mostra contagem ou as dimensões selecionadas em formato curto (ex: "Narrador → Editor").
- Menu aberto: 3 checkboxes (Narrador, Editor, Status).
- Clicar em item NÃO-marcado: adiciona ao fim do array de grouping.
- Clicar em item já marcado: remove do array (e remove subsequentes que dependiam dele? não — a ordem fica como cliques manteve).
- Item "Sem agrupamento" no topo: zera tudo de uma vez (FR-013).

**Rationale**:
- `DropdownMenu` é o componente shadcn idiomático para multi-select com checkboxes. Já vem com a11y (keyboard, focus, escape).
- Não precisamos de drag-and-drop nem setas (clarify Q2): sequência de cliques define ordem.
- Componentes shadcn já adicionados? Vou checar — se não, `bunx --bun shadcn@latest add dropdown-menu` (constituição obriga a flag `--bun`).

**Verification**: `ls src/components/ui/dropdown-menu.tsx` no plano de tarefas.

---

## R-010: Feature flag `SHOW_EARNINGS_IN_NARRATOR_GROUPS`

**Decisão**: Constante em novo arquivo `src/lib/config/feature-flags.ts`:

```ts
// src/lib/config/feature-flags.ts
export const featureFlags = {
  /**
   * Quando true, exibe a coluna de ganho (R$) nas linhas-resumo de grupos cuja
   * dimensão é "narrador". Como o ganho é pago ao editor, a label pode parecer
   * confusa ao agrupar por narrador. Iterar com `true` no v1 para validar com
   * uso real e ajustar a label OU desligar a flag.
   */
  SHOW_EARNINGS_IN_NARRATOR_GROUPS: true,
} as const;
```

**Rationale**:
- Constituição diz: feature flags como constantes de código quando o propósito é experimentação rápida (clarify Q5.4 = b). Sem dependência externa.
- Arquivo dedicado evita "magic boolean" inline em componentes; centraliza flags futuras.
- Default v1: `true` (clarify Q1).

**Uso**:
```ts
import { featureFlags } from "@/lib/config/feature-flags";
// em chapters-table:
const showEarningsForNarratorGroups = featureFlags.SHOW_EARNINGS_IN_NARRATOR_GROUPS;
```

A coluna de earnings recebe `aggregatedCell` que verifica:
- Se a row é grupo cujo grouping atual (no nível dela) é `narrator` E flag é `false` → renderiza string vazia ou oculta.

---

## R-011: Performance (SC-005, < 300 ms ao trocar agrupamento)

**Decisão**: Manter agregação 100% client-side. Padrão TanStack:
- Memoizar `columns` com `useMemo`.
- Memoizar `chapters` referência (já vem do hook `useBookDetail` como estável).
- Não fazer re-fetch ao trocar agrupamento (URL muda via `router.replace`, sem cache invalidation).

**Rationale**:
- 500 capítulos × 3 níveis de agrupamento é trivial para TanStack. Não há sinal empírico de gargalo.
- SC-005 (< 300 ms) é folgado para esse volume.

**Validation**: Teste E2E em livro com 100 capítulos mede tempo desde click no controle até linha-resumo visível (Playwright `expect.poll` com timeout < 300 ms).

---

## R-012: Bibliotecas e versões — sem novas deps

**Decisão**: Tudo com o stack já instalado:
- `@tanstack/react-table@^8.21.3` — já presente
- `next/navigation` (`useSearchParams`, `useRouter`, `usePathname`) — já em uso
- shadcn/ui `dropdown-menu`, `button` — `dropdown-menu` provavelmente já adicionado; checar e adicionar via `bunx --bun shadcn@latest add dropdown-menu` se faltar
- `lucide-react` para ícones (chevrons, check) — já presente

**Rationale**: Constituição e search-first — nada de nova dep quando o stack atende.

---

## R-013: Testes (V — TDD, regras de classificação)

**Decisão**:

**Unit** (`__tests__/unit/`):
- `lib/domain/chapter-aggregation.ts`: `sumCentsRounded`, `countByStatus`, `formatStatusBreakdown` — testes puros, sem mocks (100% cobertura, princípio II).
- `parseGroupingParam`: validação de search param — table-driven test cases.
- `formatSecondsHumanReadable` (se novo formatter for necessário para `Xh Ymin`) — table-driven.

**Integration** (`__tests__/integration/`): nenhum novo. Esta feature não toca banco.

**E2E** (`__tests__/e2e/`):
- Cenário Story 1: navegar para um livro com fixtures, agrupar por Editor, validar contagem/minutagem/ganho na linha-resumo, expandir grupo, validar capítulos ordenados.
- Cenário Story 2: idem por Narrador (incluindo capítulo `pending` sem narrador → "Sem atribuição").
- Cenário Story 3 + Story 4: combinação Narrador → Editor; reordenação via desmarcar+remarcar; URL share.
- Cenário Story 5: flag `false` esconde coluna de ganho em grupo de narrador (env override do test ou fixture sob `e2e_w*`).
- Edge: search param inválido (`?groupBy=foo`) deve renderizar tabela flat.

**Rationale**: Story 1 e 2 são P1 (E2E obrigatório). Story 3 e 4 são P2 (E2E desejável). Story 5 é P3 mas é trivial de cobrir.

---

## R-014: Acessibilidade

**Decisão**:
- `aria-expanded` no botão de expansão de grupo.
- `aria-rowgroup`/`role="rowheader"` (semântica nativa do `<TableRow>` shadcn — confirmar).
- Trigger do DropdownMenu já é keyboard-accessible (Radix).
- Label do grupo é texto, screen reader lê normalmente.

**Rationale**: Baseline da constituição + shadcn/Radix. Sem novos requisitos.

---

## R-015: Mobile (Princípio VII — Mobile First)

**Decisão**:
- O controle de agrupamento (DropdownMenu) já é mobile-friendly por padrão (Radix gerencia portal e overlay).
- A tabela com agrupamento herda o comportamento do `<ScrollArea>` já presente (`max-h-[60vh]`).
- Em telas pequenas, considerar:
  - Truncar label do grupo se muito longo (`truncate`).
  - Colunas agregadas que somem (qtd, minutagem, ganho) usam `tabular-nums` para alinhar.

**Rationale**: Constituição obriga mobile-first; tabela já cabe pelo ScrollArea horizontal. Não adicionamos colunas novas — só popula `aggregatedCell` em colunas existentes.

---

## R-016: Backwards-compat / breaking changes

**Decisão**: Nenhum breaking change externo. A migração de `chapters-table` para TanStack é internal-only (não muda interface pública do componente). O grouping é puramente aditivo (default `[]` = comportamento atual). Search params novos (`?groupBy`) não conflitam com nada existente.

---

## Resumo de decisões resolvidas

| ID | Tópico | Decisão |
|---|---|---|
| R-001 | Pré-requisito de TanStack Table | Migrar chapters-table primeiro |
| R-002 | Estratégia de renderização | Hybrid — TanStack drives state, ChapterRow renders leaves |
| R-003 | API version | v8 (`@tanstack/react-table@^8.21.3`) |
| R-004 | Colunas e aggregations | `sum` built-in + 2 customs (`sumCentsRounded`, `countByStatus`) |
| R-005 | Bucket "Sem atribuição" no fundo | Custom `sortingFn` com sentinel |
| R-006 | Sort do header dentro do grupo | Por-coluna sortingFn; grupos imunes a click |
| R-007 | URL state | `useSearchParams` + `router.replace`, parser com whitelist |
| R-008 | Expansion state | `useState` local, sobrevive a re-fetch |
| R-009 | Controle UI | shadcn `DropdownMenu` + `DropdownMenuCheckboxItem` |
| R-010 | Feature flag | `src/lib/config/feature-flags.ts`, default `true` |
| R-011 | Performance | Memoizar tudo client-side; sem fetch novo |
| R-012 | Sem novas dependências | Apenas stack atual |
| R-013 | Testes | Unit (aggregations, parser) + E2E por user story |
| R-014 | A11y | Baseline shadcn/Radix |
| R-015 | Mobile | Truncate labels + ScrollArea existente |
| R-016 | Compat | 100% aditivo |

Nenhum item Outstanding. Phase 1 pode prosseguir.

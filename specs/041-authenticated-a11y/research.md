# Research — Acessibilidade A11y 100 (D1)

Consolida as decisões do grill (2026-06-25) com a evidência de Context7 e o cálculo de
contraste. Formato: Decisão · Justificativa · Alternativas.

## R1 — Padrão ARIA do combobox (shadcn/Radix + WAI-ARIA APG)

**Decisão**: adicionar ao gatilho `role="combobox"` os atributos `aria-haspopup="listbox"` e
`aria-controls={studioPickerOpen ? <popoverContentId> : undefined}`; atribuir `id` estável ao
`PopoverContent`. Aplicar **in-place** em `book-create-dialog.tsx` e `book-edit-dialog.tsx`
(ids distintos: `book-studio-listbox` / `book-edit-studio-listbox`).

**Justificativa**:
- **Context7 (`/shadcn-ui/ui`, combobox-demo)** confirma que o exemplo oficial usa **apenas**
  `role="combobox"` + `aria-expanded` — **não** declara `aria-controls`/`aria-haspopup`. Logo o
  achado do React Doctor ("Role missing required ARIA props") é uma exigência **mais estrita**
  que a referência da lib, alinhada ao WAI-ARIA APG (combobox controla um popup via
  `aria-controls`; `aria-haspopup` explícito para popup do tipo listbox).
- **Id pendurado**: o `PopoverContent` é renderizado condicionalmente (só no DOM quando
  aberto). `aria-controls` apontando para id inexistente quando fechado dispara
  `aria-valid-attr-value` no axe — por isso o vínculo é **condicional ao `studioPickerOpen`**
  (estado visual já existente no componente; não cria estado novo → Princípio VII preservado).

**Alternativas rejeitadas**:
- `forceMount` no `PopoverContent` para usar `aria-controls` estático → mantém DOM montado
  sempre, muda comportamento e peso; desnecessário.
- Extrair `StudioCombobox` compartilhado → refactor fora do escopo de a11y; aumenta diff e
  colisão com a Sessão 4 (follow-up).

## R2 — Contraste: token global `--muted-foreground` (tema claro)

**Decisão**: escurecer `--muted-foreground` **apenas no tema claro** de `oklch(0.556 0 0)` para
**~`oklch(0.50 0 0)`** (valor final cravado pelo discovery-run + checagem visual de hierarquia).
Tema escuro (`oklch(0.708 0 0)`) **inalterado**.

**Justificativa** — cálculo de contraste (OKLCH acromático: Y = L³; razão =
(Y_claro+0.05)/(Y_escuro+0.05)):

| Cenário (tema claro) | L atual 0.556 (Y=0.172) | L proposto 0.50 (Y=0.125) |
|---|---|---|
| sobre `background`/`card` (branco, Y=1.0) | 4.73:1 (raspa) | **6.0:1** |
| sobre `muted`/`secondary`/`accent` (L 0.97, Y=0.913) | **4.34:1 (reprova)** | **5.5:1** |

- Tema escuro já passa (5.8–7.6:1) → não alterar evita regressão de hierarquia sem ganho.
- L=0.50 mantém o texto atenuado **claramente** mais claro que o `foreground` (L=0.145) →
  hierarquia preservada.
- Token **global** (não override pontual) cumpre o princípio de design tokens (IX).

**Alternativas rejeitadas**: override por componente (viola IX); mexer nos dois temas (sem
ganho no escuro); L ≤ 0.45 (escurece demais, achata a hierarquia visual).

## R3 — Estratégia de verificação (axe vs. Lighthouse)

**Decisão**: Lighthouse = **gate de aceitação** (manual local, A11y=100); axe ampliado +
asserções dirigidas = **driver de TDD/CI**.

**Justificativa** — impactos das regras axe vs. corte do helper (`critical`/`serious` reprovam;
`moderate`/`minor` só warn):

| Achado | Regra axe | Impacto | Reprova pelo helper global? |
|---|---|---|---|
| color-contrast | `color-contrast` | serious | **Sim** |
| label mismatch | `label-content-name-mismatch` | serious | **Sim** |
| td-has-header | `td-has-header` | moderate | **Não → asserção dirigida** |
| combobox ARIA | (axe pode não flagar) | — | **Não → asserção dirigida/DOM** |

- `/books` e `/books/:id` **não têm** spec axe hoje → criar `books-accessibility.spec.ts`.
- axe e Lighthouse usam motores diferentes (baseline: axe verde × Lighthouse 96) → Lighthouse
  é o juiz do "100"; axe é a rede de regressão contínua.

**Alternativas rejeitadas**: só axe (não garante o 100 do Lighthouse); automatizar Lighthouse
no CI (custo/infra fora do escopo desta sessão).

## R4 — Tabela: `scope` + header `sr-only` na coluna de arraste

**Decisão**: `scope="col"` em todos os `<th>` do cabeçalho; trocar
`<TableHead aria-hidden="true" />` da coluna de arraste por `<TableHead><span className="sr-only">
Reordenar</span></TableHead>`; **manter** `role="button"` na `ChapterGroupRow`. Confirmar
passthrough de `scope` em `src/components/ui/table.tsx` (`TableHead` deve repassar props ao
`<th>`).

**Justificativa**: `td-has-header` falha quando a coluna não tem header perceptível; o
`aria-hidden` no `<th>` da alça remove-o da árvore → `td` órfão. `scope="col"` torna a
associação explícita. Manter `role="button"` evita mudança comportamental (Sessão 4) e quebra de
seletores `getByRole`.

**Alternativas rejeitadas**: linha de grupo como célula única `colSpan` full-width (perde
alinhamento por coluna do resumo); remover `role="button"` (comportamental).

## R5 — Label mismatch: remover `aria-label` (filosofia A)

**Decisão**: remover o `aria-label` sobrescrito dos controles **com texto visível**, deixando o
texto visível ser o nome acessível; `sr-only` interno só onde faltar contexto. Alvos
confirmados pela exploração:

| Arquivo | Linha | aria-label atual | Ação |
|---|---|---|---|
| `dashboard/period-filter.tsx` | 72 | "Selecionar período customizado" | remover → nome = `{customLabel}` |
| `books/book-pdf-popover.tsx` | 73 | "Editar/Adicionar URL do PDF" | remover → nome = "Ver PDF" |
| `chapters/chapter-group-row.tsx` | 81 | "Expandir/Recolher grupo" | remover; estado via `aria-expanded` (já presente); `sr-only` opcional |

**Consequência**: muda nomes acessíveis → atualizar seletores `getByRole(..., { name })` em
e2e/unit (rodar `bun run test:e2e`).

**Alternativas rejeitadas**: enriquecer `aria-label` para conter o texto visível (nomes
verbosos/dinâmicos; mais frágil).

## R6 — Discovery-run (primeira task) — EXECUTADO 2026-06-25

**Decisão**: a 1ª task roda `bun run diagnose:lighthouse` + `diagnose:react` e **enumera** os
elementos/tokens exatos que reprovam, produzindo a lista que ancora os testes RED. Se aparecer
contraste `serious` preso a uma cor primária específica, corrigir também.

**Pré-requisito de ambiente**: DB em `localhost:5432`, build de produção (`bun run build &&
E2E_TEST_MODE=1 bun run start`) e sessão de admin semeada (`diagnose:seed`). **Nota**: em
`next start` (produção), o schema de env exige `SENTRY_DSN`/`CRON_SECRET`; usar `E2E_TEST_MODE=1`
para pular essa exigência localmente (mesmo escape da suíte E2E) — não ativa o Sentry.

### Resultado do runtime (baseline RED)

`diagnose:lighthouse` → **A11y = 96** em `/dashboard`, `/books`, `/books/:id` (mobile + desktop);
Performance/Boas Práticas/SEO sem regressão (Perf mobile dashboard 80 é pré-existente, fora do
escopo D1). `diagnose:react` → **"Role missing required ARIA props ×2"** (combobox em
`book-create-dialog.tsx:178` + `book-edit-dialog.tsx`).

### Achado-chave: contraste é MAIS amplo que a hipótese (só `--muted-foreground`)

As reprovações de `color-contrast` vêm do **padrão de badge de status** em
[status-badge.tsx](../../src/components/features/books/status-badge.tsx)
(`bg-<token>/15 text-<token>`) — texto na cor cheia do token sobre tint de 15% da mesma matiz —
e do **token `--destructive`** (texto vermelho de destaque). Medições reais (tema claro, fonte
~9pt normal):

| Elemento | fg | bg | ratio | token (tema claro) |
|---|---|---|---|---|
| badge `pending` | `#737373` | `#f5f5f5` (muted sólido) | 4.34 | `--muted-foreground` 0.556 |
| badge `reviewing` | `#bb4d00` | `#f5e4d9` (token/15) | 4.07 | `--reviewing` 0.555 |
| badge `retake` | `#ca3500` | `#f7e1d9` | 4.16 | `--retake` 0.553 |
| badge `completed` | `#007a55` | `#d9ebe6` | 4.34 | `--completed` 0.508 |
| badge `paid` | `#205cfc` | `#dee7ff` | 4.25 | `--primary` (blue) |
| badge dashboard + botão "Excluir capítulos" | `#e7000b` | `#fde6e7` | 4.00 | `--destructive` 0.577 |
| badge `editing` | `#1447e6` | `#dce3fb` | 5.34 | `--editing` 0.488 — **JÁ PASSA** |

### Valores cravados (tema claro `:root`; `.dark` inalterado — já passa)

Apenas **escurecer L** (croma/matiz preservados), alvo ≥ 4.6:1 com margem (~5.0:1), via
calculador oklch→sRGB→WCAG:

| token | L: atual → novo |
|---|---|
| `--muted-foreground` | 0.556 → **0.50** |
| `--reviewing` | 0.555 → **0.50** |
| `--retake` | 0.553 → **0.50** |
| `--completed` | 0.508 → **0.47** |
| `--destructive` | 0.577 → **0.46** |
| `--editing` | inalterado (5.34) |

### `paid`/`--primary`: fix de COMPONENTE, não de token

`STATUS_CLASSES.paid` usa `bg-primary/15 text-primary`, que reprova em **todas as 5 cores
primárias** (blue 4.25, orange 2.46, green 2.15, red 3.10, amber 2.68). Escurecer `--primary`
mudaria a cor de marca (selecionável pelo usuário, blast radius enorme) → **rejeitado**. Fix:
trocar para `bg-primary text-primary-foreground` (pareamento sólido acessível, o mesmo dos botões
primários, garantido nas 5 paletas). Visualmente, `paid` (estado terminal) passa a ter ênfase
sólida — distinção desejável dos demais badges de tint suave.

**Consequência para a spec**: US1 cresce de 1 token para **5 tokens + 1 componente**. Mantém a
filosofia (token-level, tema claro, semântico) — apenas cobre o conjunto real medido.

### Achado adicional na verificação axe (Phase 7): dark+red destructive

A rede axe (`books-accessibility.spec.ts`, 10 combos) expôs uma reprovação **pré-existente** que
o Lighthouse (só tema claro + primary azul) não pega: na paleta **dark+red**, `--destructive`
era sobrescrito para `oklch(0.55 0.22 8)` — escuro demais; o botão "Excluir capítulos"
(`bg-destructive/10 text-destructive`) dava **3.25:1** sobre o tint escuro. Corrigido para
`oklch(0.66 0.22 8)` (**5.25:1**), **clareando** o L (texto sobre fundo escuro) e mantendo a
matiz h8 — distinta do red primary (h22), preservando o teste `studios-primary-colors`
("destructive stays visually distinct from primary"). Única alteração no tema escuro desta
feature.

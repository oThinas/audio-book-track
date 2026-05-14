# UI Contract: Coluna "Prazo" na tabela de capítulos

**Feature**: 025-chapter-deadline
**Component**: `src/components/features/chapters/chapter-deadline-cell.tsx` (NOVO)
**Consumer**: `chapters-table.tsx` (coluna fixa) + `chapter-row.tsx` (linha em modo leitura)

---

## Props

```ts
interface ChapterDeadlineCellProps {
  readonly deadline: string | null;          // "YYYY-MM-DD" ou null
  readonly status: ChapterStatus;
  readonly focusContext: FocusWeekContext;   // injetado pelo hook da tabela
}
```

`FocusWeekContext` provê `todayIso`, `mondayIso`, `sundayIso` — calculados uma vez no componente pai e passados pra cada célula (puro, sem refetch).

---

## Render rules

### Caso 1 — `deadline === null`

```html
<span class="text-muted-foreground">—</span>
```

Sem tooltip. Sem ícone. Texto em token `text-muted-foreground` (combina com dark/light mode).

### Caso 2 — `deadline` definido, **não atrasado**

```html
<span title="<tooltip relativo>" data-state="upcoming">
  15/06/2026
</span>
```

- Texto: `formatDeadline(deadline)` = `"DD/MM/YYYY"` com locale `pt-BR`.
- Cor: token padrão (`text-foreground`).
- Tooltip (`<Tooltip>`): `formatRelativeDeadline(deadline, focusContext)`. Exemplos: `"em 32 dias"`, `"hoje"`, `"amanhã"`, `"ontem"`.

### Caso 3 — `deadline` definido, **atrasado** (FR-006)

```html
<span class="inline-flex items-center gap-1 text-destructive" aria-label="Atrasado">
  15/05/2026
  <AlertCircle aria-hidden="true" class="h-3.5 w-3.5" />
</span>
```

Envolvido em `<Tooltip>` com conteúdo `"Atrasado há N dias"`.

- `text-destructive`: token shadcn semântico para risco (adapta light/dark).
- `<AlertCircle>` (`lucide-react`) com `aria-hidden="true"` (decorativo; semântica já no `aria-label`).
- `aria-label="Atrasado"` no wrapper para leitor de tela.
- Tamanho do ícone: `h-3.5 w-3.5` (~14px) — proporcional ao texto `text-sm`.

---

## Estados não cobertos

- Loading da célula: a tabela inteira tem loading skeleton em outro nível; a célula sempre recebe valor resolvido.
- Erro de formato: impossível porque o tipo é `string | null` validado server-side. Se acontecer, o cell renderiza `—` (fail-safe).

---

## Acessibilidade

- Cor sozinha NÃO carrega a mensagem (atrasado) — sempre acompanhada por ícone + `aria-label` (FR-012, WCAG 1.4.1).
- Tooltip via `Tooltip` shadcn é acessível por teclado (foco no elemento dispara tooltip).
- Texto da data é selecionável e copiável (sem `user-select-none`).

---

## Dark mode

`text-destructive` e `text-muted-foreground` são tokens com pares dark — adaptação automática. Nenhuma cor hardcoded.

---

## Comportamento em ordenação

A coluna NÃO suporta ordenação (FR-013). Header é apenas `<th>Prazo</th>` sem botão clicável.

---

## Test plan

### Component (unit + DOM via Testing Library)

- `deadline = null` → renderiza `—`, sem `aria-label`.
- `deadline = futuro` → renderiza data formatada em pt-BR, sem `aria-label="Atrasado"`, tooltip mostra "em N dias".
- `deadline = passado` AND `status = pending` → renderiza com `aria-label="Atrasado"`, ícone presente, classe `text-destructive`.
- `deadline = passado` AND `status = completed` → renderiza data formatada **sem** destaque.
- `deadline = hoje` → tooltip "hoje", **sem** destaque.
- `formatRelativeDeadline` para "amanhã" (deadline = hoje + 1).
- `formatRelativeDeadline` para "ontem" (deadline = hoje - 1, mas status `paid` → na célula sem destaque, mas tooltip ainda relativo).

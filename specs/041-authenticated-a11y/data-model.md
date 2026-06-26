# Data Model — Acessibilidade A11y 100 (D1)

**Não há entidades de domínio, schema, colunas ou migrations.** Feature puramente de
apresentação/acessibilidade. Este documento registra os **artefatos de UI/estilo** afetados e a
**matriz de achados → correção** que substitui um modelo de dados.

## Tokens de design afetados (`src/app/globals.css`)

| Token | Tema | Valor atual | Valor proposto | Observação |
|---|---|---|---|---|
| `--muted-foreground` | claro (`:root`) | `oklch(0.556 0 0)` | `~oklch(0.50 0 0)` | cravado no discovery-run |
| `--muted-foreground` | escuro (`.dark`) | `oklch(0.708 0 0)` | **inalterado** | já passa 5.8–7.6:1 |

Nenhum outro token é alterado, salvo se o discovery-run revelar contraste `serious` preso a uma
cor primária específica (então o token responsável entra aqui).

## Matriz de achados → correção

| US | Achado (auditoria) | Página(s) | Arquivo:alvo | Correção |
|---|---|---|---|---|
| US1 | `color-contrast` | dashboard, books, books-detail | `globals.css` → `--muted-foreground` (claro) | escurecer token global |
| US2 | Role missing ARIA props | (diálogos de livro) | `book-create-dialog.tsx`, `book-edit-dialog.tsx` | `aria-haspopup="listbox"` + `aria-controls` condicional + `id` no `PopoverContent` |
| US3 | `td-has-header` | books-detail | `chapters-table.tsx`, `chapter-group-row.tsx`, `ui/table.tsx` | `scope="col"` em `<th>` + header `sr-only` na coluna de arraste |
| US4 | `label-content-name-mismatch` | dashboard, books-detail | `period-filter.tsx`, `book-pdf-popover.tsx`, `chapter-group-row.tsx` | remover `aria-label` sobrescrito |

## Estados/atributos ARIA (sem persistência)

- **Combobox** (por diálogo): `role="combobox"` (existente), `aria-expanded` (existente),
  `aria-haspopup="listbox"` (novo), `aria-controls` (novo, condicional a `studioPickerOpen`),
  `aria-invalid` (existente). `PopoverContent` ganha `id` estável.
- **Linha de grupo**: `role="button"` (mantido), `aria-expanded` (mantido), `aria-label`
  (**removido** — nome passa a vir do conteúdo).

## Test doubles / dados de teste

- `books-accessibility.spec.ts` semeia **um livro + capítulos** via factory
  (`__tests__/helpers/factories.ts`, padrão `createTestBook`) no `beforeEach`, conforme a regra
  "factory, não seed" da constituição. Sem alteração em `seed-test.ts`.
- Reuso de `checkAccessibility(page, label)` (10 combinações tema×cor) para `/books` e
  `/books/:id`.

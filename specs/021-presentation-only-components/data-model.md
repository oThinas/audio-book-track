# Phase 1 — Data Model & Audit

**Branch**: `021-presentation-only-components`
**Date**: 2026-04-30

> Esta feature é uma **refatoração arquitetural** sem mudanças no modelo de domínio. Não há entidades de banco novas, não há `data-model` no sentido tradicional. Este documento cobre dois artefatos exigidos pelo planejamento:
>
> 1. **Auditoria** — classificação dos 41 componentes em `src/components/features/**` (já conforme / migrar / fora do escopo).
> 2. **Estrutura canônica do hook** — o "schema" interno (interface TS, ciclo de vida, invariantes) que serve como modelo replicável.

---

## 1. Auditoria de Conformidade — `src/components/features/**`

Classificação obtida por inspeção dos arquivos `.tsx` (LOC + análise das chamadas `useState`/`useEffect`/`fetch`/`router.refresh()`/mutações inline). Critério de classificação:

- **🟢 Conforme**: componente é puramente apresentacional (sem `useState` de domínio, sem `fetch`, sem `useEffect` de side-effect, sem mutação inline). Mantém-se inalterado.
- **🟡 Migrar (lógica → hook)**: componente mistura renderização com estado de domínio, side-effects ou mutações. Será refatorado.
- **⚪ Fora do escopo**: primitivo de UI ou layout (não pertence a `features/**` mas listado aqui se compartilhado), ou caso especial documentado.

| Feature | Componente | LOC | Classificação | Hook(s) a criar |
|---|---|---:|---|---|
| **studios** (P1 — referência) | `studios-client.tsx` | 108 | 🟡 | `use-studios-list.ts` |
| | `studios-table.tsx` | 175 | 🟢 | (presentação parametrizada) |
| | `studio-row.tsx` | 234 | 🟡 | `use-studio-row.ts` (modo edição inline) |
| | `studio-new-row.tsx` | 158 | 🟡 | `use-create-studio-form.ts` |
| | `delete-studio-dialog.tsx` | 104 | 🟡 | `use-delete-studio.ts` |
| **settings** (P2-1) | `theme-selector.tsx` | 55 | 🟢 | (compõe `useTheme` + `useAutoSavePreference` existentes) |
| | `font-size-selector.tsx` | 55 | 🟢 | (idem — compõe hook existente) |
| | `primary-color-selector.tsx` | 59 | 🟡 | `use-primary-color-selector.ts` (callback que combina lógica) |
| | `favorite-page-selector.tsx` | 59 | 🟡 | `use-favorite-page-selector.ts` |
| | `preference-initializer.tsx` | 22 | 🟡 | `use-preference-initializer.ts` (`useEffect` único de bootstrap) |
| **auth** (P2-2) | `login-form.tsx` | 133 | 🟡 | `use-login-form.ts` |
| | `logout-button.tsx` | 39 | 🟡 | `use-logout.ts` |
| **narrators** (P2-3) | `narrators-client.tsx` | 108 | 🟡 | `use-narrators-list.ts` |
| | `narrators-table.tsx` | 167 | 🟢 | (presentação parametrizada) |
| | `narrator-row.tsx` | 194 | 🟡 | `use-narrator-row.ts` |
| | `narrator-new-row.tsx` | 127 | 🟡 | `use-create-narrator-form.ts` |
| | `delete-narrator-dialog.tsx` | 104 | 🟡 | `use-delete-narrator.ts` |
| **editors** (P2-4) | `editors-client.tsx` | 108 | 🟡 | `use-editors-list.ts` |
| | `editors-table.tsx` | 170 | 🟢 | (presentação parametrizada) |
| | `editor-row.tsx` | 222 | 🟡 | `use-editor-row.ts` |
| | `editor-new-row.tsx` | 146 | 🟡 | `use-create-editor-form.ts` |
| | `delete-editor-dialog.tsx` | 104 | 🟡 | `use-delete-editor.ts` |
| **books + chapters** (P2-5) | `books-client.tsx` | 96 | 🟡 | `use-books-list.ts` |
| | `books-table.tsx` | 201 | 🟡 | `use-books-table.ts` (filtros/seleção) |
| | `book-create-dialog.tsx` | 380 | 🟡 | `use-create-book-form.ts` (chama `studio-inline-creator`) |
| | `book-edit-dialog.tsx` | 481 | 🟡 | `use-edit-book-form.ts` (form mais complexo do projeto) |
| | `book-detail-client.tsx` | 255 | 🟡 | `use-book-detail.ts` |
| | `book-header.tsx` | 123 | 🟢 | (apresentação) |
| | `book-pdf-popover.tsx` | 185 | 🟡 | `use-book-pdf-popover.ts` |
| | `chapter-count-input.tsx` | 84 | 🟢 | (input controlado puro) |
| | `status-badge.tsx` | 33 | 🟢 | (mapping puro status → cor/label) |
| | `studio-inline-creator.tsx` | 124 | 🟡 | `use-studio-inline-creator.ts` |
| | `chapters-table.tsx` | 123 | 🟢 | (presentação parametrizada) |
| | `chapter-row.tsx` | 180 | 🟡 | `use-chapter-row.ts` |
| | `chapter-row-edit-mode.tsx` | 302 | 🟡 | `use-chapter-row-edit.ts` + helper puro `lib/domain/chapter-transitions.ts` (R7) |
| | `chapter-status-select.tsx` | 73 | 🟢 | (select controlado) |
| | `chapter-delete-dialog.tsx` | 58 | 🟡 | `use-delete-chapter.ts` |
| | `chapter-paid-reversion-dialog.tsx` | 53 | 🟡 | `use-paid-reversion.ts` |
| | `chapters-bulk-delete-bar.tsx` | 51 | 🟢 | (barra de ação parametrizada) |
| | `chapters-bulk-delete-confirm.tsx` | 65 | 🟡 | `use-bulk-delete-chapters.ts` |
| **TOTAL** | | **5518** | **41 componentes** | **~28 hooks novos** |

### Resumo da auditoria

| Classificação | Quantidade |
|---|---:|
| 🟢 Conforme (sem refatoração necessária) | 13 |
| 🟡 Migrar (lógica → hook) | 28 |
| ⚪ Fora do escopo | 0 |

### Observações

1. **Componentes >200 LOC (anti-padrão Princípio XII)**: 5 hoje (`book-edit-dialog` 481, `book-create-dialog` 380, `chapter-row-edit-mode` 302, `book-detail-client` 255, `studio-row` 234, `editor-row` 222, `books-table` 201). A refatoração resolve **todos** por consequência (lógica sai para hook; JSX restante fica < 200 LOC ou se aproxima).
2. **Settings selectors borderline**: `theme-selector` e `font-size-selector` apenas compõem `useTheme` + `useAutoSavePreference` (hooks existentes em `src/lib/hooks/`). Classificados como 🟢 — não há lógica de domínio no componente, apenas glue. Critério: glue trivial (1 callback de uma linha que delega para hook existente) **não** demanda novo hook.
3. **`primary-color-selector` e `favorite-page-selector`**: aparentam ter lógica adicional (`useState` para preview, callbacks de onChange/onMouseEnter); precisam de hook próprio. Será confirmado durante implementação — se forem tão simples quanto `theme-selector`, reclassificar para 🟢.
4. **`preference-initializer`** (22 LOC, único `useEffect` de bootstrap): pequeno mas representa o anti-padrão (`useEffect` de side-effect direto no componente). Extrair para `use-preference-initializer` mantém consistência e libera o componente para virar 🟢.

---

## 2. Estrutura Canônica do Hook

### 2.1 Interface TypeScript

```ts
// Forma genérica — não é um tipo concreto, é o "shape" que todo hook de feature respeita.

interface FeatureHookReturn {
  // 1. Estado derivado/visível (read-only do ponto de vista do componente)
  readonly <data fields>: ...;
  readonly <flags>: boolean;

  // 2. Callbacks (estáveis — useCallback quando passados para componentes filhos)
  readonly handle<Action>: (...args) => void | Promise<void>;
}

// Hook de mutação (form/dialog):
interface MutationHookReturn<TInput> {
  readonly isSubmitting: boolean;
  readonly error: string | null;
  readonly onSubmit: (input: TInput) => Promise<void>;
  // Opcional:
  readonly reset: () => void;
}
```

### 2.2 Ciclo de vida

1. **Inicialização**: hook recebe dados iniciais via parâmetros (vindos de Server Component) e **nunca** faz fetch para dados que já existem no servidor — Server Components carregam, Client Hook gerencia.
2. **Estado interno**: `useState`/`useReducer` para estado controlado pelo componente (modo edição, valor pendente, dialog target). Memoização (`useMemo`) para derivações caras.
3. **Mutações**: hook expõe callbacks que executam `fetch` para `/api/v1/**`, atualizam estado local otimisticamente (quando aplicável) ou esperam resposta, e disparam `router.refresh()` para sincronizar Server Components.
4. **Side-effects**: `useEffect` permitido **dentro do hook** quando há side-effect real (subscribe, sync, bootstrap inicial). Nunca mais no componente.
5. **Erros**: hook captura erros de fetch, expõe via `error` ou `form.setError`. Componente apenas renderiza a mensagem.

### 2.3 Invariantes

- **I1**: Hook **não** retorna JSX. Retorna apenas dados, flags e callbacks.
- **I2**: Hook **não** importa nada de `@/components/ui/**` ou `@/components/features/**`. Apenas tipos de domínio (`@/lib/domain/**`), tipos de repositório (`@/lib/repositories/**` para shapes), e bibliotecas (React, RHF, Zod, sonner).
- **I3**: Componente que consome o hook **não** importa `@/lib/services/**` ou `@/lib/repositories/**` exceto para tipos. Componente fala HTTP via hook, nunca diretamente.
- **I4**: Hook é puramente síncrono na sua chamada inicial; assincronia acontece dentro de callbacks expostos. Componente **nunca** vê `Promise` retornada do hook na chamada.
- **I5**: Hook é testável com `renderHook` sem renderizar nenhum componente real.

### 2.4 Anti-padrões dentro do próprio hook

- ❌ Retornar setState bruto: `return { setStudios }` — preferir `handleStudioCreated(studio)` que encapsula a regra ("incrementa, mantém ordenação, invalida cache").
- ❌ Aninhar hooks: `function useFoo() { const bar = useBar(...) }` está OK; **chamar hooks dentro de callbacks** continua proibido pelas Rules of Hooks.
- ❌ Closures sobre props mutáveis sem dependency array: revisar todo `useCallback`/`useMemo` com lint do React.
- ❌ Side-effects sem cleanup quando há subscription.

---

## 3. Estado de domínio vs. Estado visual local — critério objetivo

Critério para distinguir o que **vai para hook** (estado de domínio, lógica) do que **fica no componente** (estado visual local):

| Tipo de estado | Vai para... | Exemplo |
|---|---|---|
| Lista de entidades carregadas (`studios`, `chapters`) | **Hook** | `useStudiosList` |
| Modo de edição inline de uma entidade | **Hook** | `useStudioRow.isEditing` |
| Alvo de dialog (`studioToDelete`, `chapterToRevert`) | **Hook** | `useStudiosList.studioToDelete` |
| Filtros, paginação, seleção em massa | **Hook** | `useBooksTable.selectedIds` |
| Status de mutação (`isSubmitting`, `error`) | **Hook** | hooks de mutação |
| Open/close de Popover/Tooltip controlado por composição Radix | **Componente** | `<Popover open={open} onOpenChange={setOpen}>` |
| Valor temporário de input não-validado (digitando) | **Componente** | `<Input value={local} onChange={...}>` (quando não tem validação cross-field) |
| Foco, hover ou state CSS-only | **Componente** | classes condicionais |
| Valor de form **com validação** (RHF) | **`useForm` no componente** + **hook para submit** | ver R4 |

**Heurística rápida**: se o estado descreve **"o que existe no domínio"** ou **"qual ação está em andamento"**, vai para hook. Se descreve **"como esta UI está desenhada agora"** e desaparece com o componente sem afetar lógica, fica no componente.

---

**Status**: Phase 1 data-model concluído. Avançar para `contracts/`.

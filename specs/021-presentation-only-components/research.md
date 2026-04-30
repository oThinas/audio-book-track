# Phase 0 Research: Componentes Apenas de Renderização (Lógica em Hooks)

**Branch**: `021-presentation-only-components`
**Date**: 2026-04-30
**Status**: Complete — todas as NEEDS CLARIFICATION resolvidas

Decisões técnicas que precisavam ser fechadas antes do Phase 1 (Design & Contracts) e da geração de tasks.

---

## R1 — Convenção de retorno dos hooks

**Decision**: Hooks retornam um **objeto nomeado** com chaves auto-documentadas (`{ studios, isLoading, error, createStudio, deleteStudio }`). Tupla é proibida exceto para hooks utilitários puramente sintáticos (ex.: `useDebounce` retornando o valor único).

Forma canônica de um hook de feature:

```ts
function useStudiosList(initial: readonly StudioListItem[]) {
  // ...
  return {
    // Estado derivado/visível
    studios,          // readonly StudioListItem[]
    sortedStudios,    // readonly StudioListItem[] (memoizada)
    isCreating,       // boolean — modo "criação inline" ativo
    studioToDelete,   // Studio | null — alvo do dialog de delete

    // Callbacks (estáveis via useCallback quando consumidos por children)
    handleNewClick,
    handleCreated,
    handleCancelled,
    handleUpdated,
    handleRequestDelete,
    handleDeleteDialogChange,
    handleDeleted,
  } as const;
}
```

**Rationale**:

- Objetos nomeados sobrevivem a refatoração (ordem irrelevante; chaves auto-documentadas no destructuring no componente).
- Tuplas só ganham na assinatura curta de utilitários (`const [open, setOpen] = useDisclosure()`); para feature hooks com 5+ propriedades, perdem legibilidade.
- `as const` opcional: melhora inferência quando útil; não é obrigatório.

**Reforço pós-consulta a `/frontend-patterns`** (R9): callbacks expostos pelo hook que serão **passados a componentes filhos** DEVEM ser estáveis via `useCallback`. Isto preserva memoização downstream (`React.memo` em rows, por exemplo) e evita re-renders em cascata. Critério prático: callback sempre que cruza a fronteira hook → componente → componente-filho passa por `useCallback`. Callback que só serve ao próprio JSX do consumidor pode ficar sem `useCallback` (sem ganho).

**Alternatives considered**:

- **Tupla `[state, callbacks]`**: descartada — ordem volátil, péssima para feature hooks.
- **Classe** (encapsulamento via `useRef` + métodos): descartada — não-idiomático em React; dificulta SSR.
- **Múltiplos hooks pequenos retornando primitivas**: descartado — gera ruído de chamadas no componente.

---

## R2 — Granularidade: 1 hook único vs. múltiplos por feature

**Decision**: **Um hook por componente que precisa de lógica**, co-localizados em `src/components/features/<feature>/hooks/`. Para Estúdios (P1):

| Componente | Hook |
|---|---|
| `studios-client.tsx` | `use-studios-list.ts` (estado da listagem + dialog state) |
| `studio-row.tsx` | `use-studio-row.ts` (modo edição inline da linha) |
| `studio-new-row.tsx` | `use-studio-new-row.ts` (form criação inline) |
| `delete-studio-dialog.tsx` | `use-delete-studio.ts` (mutação delete + refetch) |
| `studios-table.tsx` | (sem hook — puramente apresentação parametrizada por `studios-client`) |

**Rationale**:

- Hook por componente garante que **abrir o componente revela o hook que precisa** — sem caçar lógica em hook gigante de feature.
- Hooks específicos ficam **testáveis isoladamente** (cada hook tem suas próprias dependências de fetch/mutação), com cobertura granular.
- Promove reutilização real: se `studio-row` ganhar variante (ex.: row em modal), `use-studio-row` é portável.

**Alternatives considered**:

- **1 hook único por feature** (`useStudiosFeature` retornando tudo): descartado — vira god-hook (>300 LOC), difícil de testar, mascara dependências.
- **Hook só no container** (`studios-client`), filhos recebendo props derivadas: parcialmente válido, mas componentes filhos com lógica própria (ex.: form de criação inline com seu próprio fetch) ainda misturam lógica e apresentação. Decisão: **componente que dispara mutação OU mantém estado de domínio próprio ganha hook próprio**.

**Critério objetivo**: se um componente tem `useState` de domínio, `useEffect` de side-effect, ou dispara `fetch`/`mutate`, ele tem hook próprio. Componentes puramente apresentacionais (`studios-table`, `studio-row` em modo leitura) não precisam.

---

## R3 — Padrão de teste de hooks (Vitest + Testing Library)

**Decision**: Testes unitários com `renderHook` de `@testing-library/react` (versão atual no projeto via React 19.2). Mock de `fetch` global via `vi.fn().mockResolvedValue(...)` quando o hook chama `fetch` direto. Para hooks que recebem deps via parâmetro (ex.: `mutate` injetado), usar fakes via `vi.fn()` sem `vi.mock()`.

Estrutura canônica:

```ts
// __tests__/unit/components/features/studios/use-studios-list.spec.ts
import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useStudiosList } from "@/components/features/studios/hooks/use-studios-list";

describe("useStudiosList", () => {
  test("inicia com a lista fornecida e nenhuma criação ativa", () => {
    const initial = [{ id: "1", name: "Estúdio A", booksCount: 2 }];
    const { result } = renderHook(() => useStudiosList(initial));

    expect(result.current.studios).toEqual(initial);
    expect(result.current.isCreating).toBe(false);
    expect(result.current.studioToDelete).toBeNull();
  });

  test("ordena por createdAt desc via sortedStudios", () => { /* ... */ });

  test("handleCreated insere o estúdio com booksCount=0 e desliga modo criação", () => {
    const initial: StudioListItem[] = [];
    const { result } = renderHook(() => useStudiosList(initial));

    act(() => {
      result.current.handleNewClick();
    });
    expect(result.current.isCreating).toBe(true);

    act(() => {
      result.current.handleCreated({ id: "new", name: "X", createdAt: "..." });
    });
    expect(result.current.studios).toHaveLength(1);
    expect(result.current.studios[0].booksCount).toBe(0);
    expect(result.current.isCreating).toBe(false);
  });
});
```

**Rationale**:

- `renderHook` é a API canônica para testar hooks isolados sem renderizar JSX, alinhado com a regra "componentes puramente apresentacionais → cobertos por E2E/integration; hooks → cobertos por unit".
- Convenção de test doubles do projeto (CLAUDE.md): fakes manuais e `vi.fn()` para módulos internos; `vi.mock()` apenas para a allowlist (`next/headers`, `next/navigation`, `@/lib/db`, `@/lib/env`, etc.).
- Para hooks que disparam `fetch` (ex.: `use-delete-studio`), o `fetch` é a borda externa: stub global via `globalThis.fetch = vi.fn()` no `beforeEach` é aceitável e permanece sem `vi.mock()`.

**Alternatives considered**:

- **Apenas testes E2E/integration** cobrindo o hook indiretamente: descartado — confronta SC-003 (≥80% cobertura unitária dos hooks); E2E/integration são lentos demais para testar combinações de estado.
- **`react-test-renderer`**: obsoleto para React 18+; `@testing-library/react` é o padrão.
- **Snapshot tests do retorno**: descartado — quebradiços; preferimos asserts explícitos por chave.

---

## R4 — React Hook Form (RHF): onde mora `useForm()`

**Decision**: `useForm()` permanece **dentro do componente do formulário**. O hook customizado (`use<Action><Entity>Form`) é responsável pelo **submit handler**, mutação HTTP, refetch/`router.refresh()`, e estado de submissão (`isSubmitting`, `error`). O hook recebe o `form` (instância do RHF) ou os valores como argumento, e devolve `{ onSubmit, isSubmitting, error, reset }`.

Padrão:

```tsx
// studio-new-row.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { studioFormSchema, type StudioFormValues } from "@/lib/domain/studio";
import { useCreateStudioForm } from "./hooks/use-create-studio-form";

export function StudioNewRow({ onCreated, onCancelled }: Props) {
  const form = useForm<StudioFormValues>({
    resolver: zodResolver(studioFormSchema),
    defaultValues: { name: "" },
  });
  const { onSubmit, isSubmitting, error } = useCreateStudioForm({ form, onCreated });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} /* ... */>
        {/* JSX puro */}
      </form>
    </Form>
  );
}
```

**Rationale**:

- `useForm()` é o ponto de integração com `<Form>` / `FormField` do shadcn/ui — extrair acopla demais e perde ergonomia.
- Submit handler + mutation + refetch é **lógica de fluxo**, não rendering — vai pro hook por definição da feature.
- Hook recebe `form` para poder fazer `form.reset()` após sucesso, `form.setError(...)` em validação server-side, sem o componente saber dos detalhes.

**Alternatives considered**:

- **Mover `useForm()` para o hook**: descartado — força o componente a destructurar `{ form }` e re-injetar em `<Form {...form}>`, sem ganho real e perdendo a tipagem inline natural.
- **Sem hook (form + submit + mutation tudo no componente)**: descartado — viola o princípio (componente conhece a camada de dados).

---

## R5 — Refetch após mutação: `router.refresh()` permanece

**Decision**: Manter `router.refresh()` (Next.js App Router) após mutações que precisam re-buscar dados do servidor. Optimistic updates ficam fora do escopo desta feature (feature futura). Mutação responsabilidade do hook:

```ts
function useCreateStudioForm({ form, onCreated }: Args) {
  const router = useRouter();
  const onSubmit = async (values: StudioFormValues) => {
    const res = await fetch("/api/v1/studios", {
      method: "POST",
      body: JSON.stringify(values),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      // ... tratar erro, form.setError, return
      return;
    }
    const { data, reactivated } = (await res.json()) as { data: Studio; reactivated?: boolean };
    onCreated(data);
    router.refresh();
    if (reactivated) toast.warning(`Estúdio "${data.name}" foi desarquivado.`);
  };
  return { onSubmit, isSubmitting: form.formState.isSubmitting, error: /* ... */ };
}
```

**Rationale**:

- Padrão atual do projeto (visto em `studios-client.tsx`, `narrators-client.tsx`); migrar para outra estratégia (TanStack Query, SWR) é mudança de arquitetura — fora do escopo (Princípio IV: YAGNI).
- `router.refresh()` recarrega Server Components e mantém URL/state inalterados — encaixa na arquitetura "Server Component = data fetching, Client Component = interatividade".
- Hooks de mutação centralizam o `router.refresh()` em um único lugar por feature, eliminando duplicação espalhada hoje pelos componentes.

**Alternatives considered**:

- **TanStack Query**: introduziria dependência nova, padrão de cache cliente, mudança maior. Out of scope.
- **Server Actions**: válido, mas mistura padrões com a API REST existente; manter consistência com `/api/v1/**`.
- **Optimistic updates manuais**: viáveis em casos pontuais, mas não como padrão default — adicionar quando demanda concreta surgir.

---

## R6 — Naming convention dos hooks

**Decision**: `use-<feature>-<scope>.ts` em kebab-case (alinhado com as rules globais e o pattern existente em `use-mobile-menu.ts`, que sai de `src/lib/hooks/` para `src/components/layout/hooks/` na Phase 1.5). Export como camelCase: `useStudiosList`, `useStudioRow`, `useDeleteStudio`.

Convenções:

- **Listagem/container de feature**: `use-<feature>-list.ts` (ex.: `use-studios-list`).
- **Linha/item editável**: `use-<entity>-row.ts` (ex.: `use-studio-row`, `use-narrator-row`).
- **Form de criação inline**: `use-<entity>-new-row.ts` (ex.: `use-studio-new-row`).
- **Action específica (delete, archive, paid-revert)**: `use-<verb>-<entity>.ts` (ex.: `use-delete-studio`, `use-paid-reversion`).
- **Form genérico (create/edit)**: `use-<verb>-<entity>-form.ts` (ex.: `use-create-studio-form`, `use-update-studio-form`). Pode ser combinado em `use-<entity>-form.ts` quando create e update compartilham a maior parte da lógica.

**Rationale**:

- kebab-case do arquivo + camelCase do export é o padrão TS do projeto (idem para `lib/hooks/`).
- Sufixos `-list`, `-row`, `-new-row`, `-form`, `-dialog` mapeiam 1:1 com o nome do componente — elimina ambiguidade ("qual hook este componente usa?").

**Alternatives considered**:

- **Naming livre por feature**: descartado — gera inconsistência entre features e dificulta navegação.
- **Hooks anônimos colocados em `studios-client.tsx`**: viola o princípio (hook continua acoplado ao componente).

---

## R7 — Migração do `chapter-row-edit-mode` (state machine)

**Decision**: A lógica de edição inline de capítulo (atualmente 302 LOC em `chapter-row-edit-mode.tsx`) sai para **dois hooks combinados**:

- `use-chapter-row-edit.ts` — orquestra modo edição/leitura, validação local de transições permitidas (espelhada do backend), submit da mutação `PUT /api/v1/chapters/:id`, refetch. **Implementado com `useReducer`** em vez de múltiplos `useState` — a state machine tem ≥ 6 estados (`pending`, `editing`, `reviewing`, `retake`, `completed`, `paid`) e ≥ 8 transições, e `useReducer` torna as transições explícitas (`dispatch({ type: "TRANSITION", to: "reviewing" })`) e testáveis em isolamento (testar a função reducer pura sem `renderHook`).
- `use-chapter-status-transition.ts` — pure function helper (não é hook) em `src/lib/domain/chapter-transitions.ts` que valida `(currentStatus, nextStatus, hasNarrator, hasEditor, editedSeconds) → { allowed: boolean, reason?: string }`. Reutilizado pelo backend e pelo hook.

O componente `chapter-row-edit-mode.tsx` fica reduzido a JSX de inputs + botões controlados pelo retorno do hook.

**Reforço pós-consulta a `/frontend-patterns`** (R9): a skill recomenda Context + Reducer para estado complexo. No nosso caso a state machine é **local ao row**, não global — Context é exagero. `useReducer` dentro do hook é o ponto certo. Se aparecer demanda futura para compartilhar a state machine entre rows (ex.: capítulos sincronizados), o caminho de evolução é `useReducer` no hook → extrair para Context ao redor da página `/books/:id`.

**Rationale**:

- State machine **é lógica pura** — separa de qualquer JSX e ganha cobertura de teste fácil (function pura testável com tabela exaustiva de transições).
- Hook usa o helper puro, deixando claro o que é validação síncrona local vs. mutação HTTP.
- Backend já tem essa lógica; o helper é a fonte da verdade compartilhada (criar agora, pois extrair depois também é YAGNI-compliant — o duplicado já existe em frontend e backend, esta refatoração consolida).

**Alternatives considered**:

- **Hook gigante único**: replica o problema de hoje (302 LOC concentradas).
- **Confiar 100% no backend para validar transições e remover validação client-side**: descartado — UX exige feedback imediato de "transição inválida" sem round-trip.

---

## R8 — Server Components como contraste

**Decision (não-mudança)**: Server Components (todas as `page.tsx` que hoje fazem `async function Page()` e fetcham dados direto) **permanecem inalterados**. A regra incide exclusivamente sobre componentes com `"use client"`.

**Rationale**:

- Server Components não usam hooks de estado, então a regra é trivialmente satisfeita por construção.
- Reforça o padrão arquitetural existente (Princípio VII): Server Component = onde dados moram; Client Component = interatividade; hook customizado = lógica do Client Component.

**Alternatives considered**:

- **Forçar mesmo padrão em Server Components**: sem sentido (Server Components não têm estado/efeitos de cliente).

---

## R9 — Reconciliação com `/frontend-patterns` e `/frontend-design`

**Decision**: as skills foram consultadas após o draft inicial de R1–R8. Ajustes incorporados:

| Tema na skill | Ajuste em R1–R8 | Resultado |
|---|---|---|
| `useCallback` para callbacks passados a children (skill: "useCallback for functions passed to children") | Reforço explícito em **R1** | Callbacks que cruzam fronteira hook → componente → filho sempre `useCallback`. Callbacks só consumidos no JSX do próprio componente, opcional. |
| Context + Reducer para estado complexo (skill: padrão `useReducer` + Context) | Aplicado parcialmente em **R7** | `useChapterRowEdit` usa `useReducer` (state machine ≥6 estados) — Context não é necessário (state local ao row). |
| Composition over inheritance, compound components | Já implícito via shadcn/ui | Sem ajuste — convenção existente cobre. |
| Render props | Não usamos | Hook é a abstração escolhida (R1). Render props ficaria para casos específicos de "headless" UI, não aplica aqui. |
| Memoização (useMemo / React.memo) | R1 já cobre `useMemo`; reforço pós-skill: **`React.memo`** em componentes "row" que ficam dentro de listas longas (`StudioRow`, `NarratorRow`, `EditorRow`, `ChapterRow`) | **Adendo de implementação**: ao refatorar `*-row.tsx`, envolver o export com `React.memo()` se a row receber callbacks estáveis (depende do `useCallback` em R1). Cobertura de teste: caso unitário com `renderHook` confirma que callbacks são estáveis entre re-renders do pai. |
| Code splitting / lazy loading | **Gap real** — adicionado a Phase 6 (Polish) em [tasks.md](./tasks.md) | Dialogs grandes (`book-edit-dialog` 481 LOC, `book-create-dialog` 380 LOC) viram `lazy(() => import(...))` + `<Suspense>` na página que os abre, reduzindo bundle inicial. |
| Error Boundary (skill: padrão de boundary por feature) | **Gap defensivo** — não-crítico agora; flagged como follow-up | Hooks expõem `error` para erros de fluxo (HTTP), mas erros de render permanecem capturados pelo error boundary global do Next.js (`error.tsx`). Adicionar boundaries por-feature **não** entra nesta feature; pode entrar em PR futuro caso necessidade apareça. |
| Virtualization (skill + Princípio VIII) | Já mandatado pela constituição | Sem ajuste — listas >50 itens já usam `@tanstack/react-virtual`. |
| Form handling | RHF supera o exemplo controlled state da skill | R4 mantido. |
| Acessibilidade (keyboard navigation, focus management) | Skill mostra padrões; nossa aplicação atual já segue (shadcn/ui + a11y tests E2E `/test:e2e accessibility`) | Sem ajuste necessário; smoke E2E captura regressões. |
| `/frontend-design` — preserve established design system | Refactor não muda visual (FR-012) | ✅ alinhado por construção. |

**Status pós-reconciliação**: R1 reforçada (`useCallback`), R7 detalhada (`useReducer` para state machine), Phase 6 ganhou tasks de lazy loading. Demais decisões permanecem.

---

## Sumário das decisões

| # | Decisão | Impacto |
|---|---|---|
| R1 | Hook retorna objeto nomeado; callbacks cruzando fronteira filho via `useCallback` | Define shape dos contratos em Phase 1 |
| R2 | Hook por componente que precisa de lógica (não god-hook) | 4 hooks em P1 (Estúdios) |
| R3 | `renderHook` + Vitest; fakes manuais (CLAUDE.md convention) | Define template de teste em quickstart |
| R4 | RHF: `useForm` no componente; submit/mutation no hook | Define padrão para todos os forms |
| R5 | `router.refresh()` permanece como mecanismo de refetch | Sem dependência nova; sem cache cliente |
| R6 | Naming `use-<feature>-<scope>.ts` em kebab-case | Convenção replicável |
| R7 | State machine de capítulos: hook com `useReducer` + helper puro em `lib/domain/` | Separa validação de mutação; transições explícitas |
| R8 | Server Components inalterados | Escopo restrito a Client Components |
| R9 | Reconciliação com `/frontend-patterns` e `/frontend-design` | Reforça R1; detalha R7; adiciona lazy loading em Phase 6; ✅ alinhado a /frontend-design |

**Status**: Phase 0 completo. Sem `[NEEDS CLARIFICATION]` remanescentes. Avançar para Phase 1 (Design & Contracts).

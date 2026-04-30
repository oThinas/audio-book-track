# Quickstart — Como refatorar uma feature para o padrão "componentes apresentacionais + hooks"

**Branch**: `021-presentation-only-components`
**Audience**: engenheiros executando P1 (Estúdios) e P2 (configurações → autenticação → narradores → editores → livros & capítulos).
**Estimated time per feature**: 2–6h dependendo do tamanho (settings ≈ 2h, books/chapters ≈ 6h).

> Esta receita é **replicada por feature**. Cada feature vira um PR contra `main`. Não migrar duas features no mesmo PR.

---

## Pré-requisitos

- Branch atual: `021-presentation-only-components` ou branch derivada (`022-refactor-narrators`, etc., conforme convenção decidida em `/speckit-tasks`).
- Suíte verde: `bun run test:unit && bun run test:integration && bun run test:e2e` antes de começar (oráculo de comportamento).
- Familiaridade com:
  - [contracts/](./contracts/) — assinaturas canônicas dos hooks de Estúdios (referência).
  - [research.md](./research.md) — decisões R1–R8.
  - [data-model.md](./data-model.md) — critério "estado de domínio vs. visual local".
  - Constituição **Princípio VII** (frontend) e **XII** (anti-padrões).

---

## Passo 1 — Inventariar a feature

Liste os arquivos `.tsx` da feature:

```bash
ls src/components/features/<feature>/*.tsx
```

Para cada arquivo, classifique conforme a [auditoria](./data-model.md#1-auditoria-de-conformidade--srccomponentsfeatures):

- 🟢 **Conforme**: pular.
- 🟡 **Migrar**: extrair lógica para hook.

Use `grep -E 'useState|useEffect|useRef|fetch\(|router\.refresh' src/components/features/<feature>/*.tsx` para confirmar o que precisa migrar.

## Passo 2 — Criar a estrutura de hooks

```bash
mkdir -p src/components/features/<feature>/hooks
mkdir -p __tests__/unit/components/features/<feature>
```

## Passo 3 — Para cada componente 🟡, escrever o teste do hook PRIMEIRO (TDD/RED)

Padrão R3 (research.md). Use `renderHook` de `@testing-library/react`. Assertar:

1. **Estado inicial** correto.
2. **Cada callback** publicado pelo contrato — comportamento de sucesso e de erro.
3. **Side-effects** — `fetch` foi chamado com URL/método/body corretos; `router.refresh` chamado quando aplicável; `onCreated/onUpdated/onDeleted` propagado.
4. **Anti-toast-success** — assert explícito de que `toast.success` jamais é chamado (Princípio VII).

Exemplo mínimo:

```ts
// __tests__/unit/components/features/<feature>/use-<feature>-list.spec.ts
import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { useFooList } from "@/components/features/foo/hooks/use-foo-list";

describe("useFooList", () => {
  test("initial state", () => {
    const { result } = renderHook(() => useFooList([]));
    expect(result.current.items).toEqual([]);
  });
  // ...
});
```

Rode `bun run test:unit __tests__/unit/components/features/<feature>` — testes devem **falhar** (RED).

## Passo 4 — Implementar o hook (GREEN)

Em `src/components/features/<feature>/hooks/use-<scope>.ts`:

1. Crie a interface de retorno (`UseFooListReturn`) seguindo o padrão R1 (objeto nomeado).
2. Mova **toda** a lógica do componente correspondente para dentro do hook:
   - `useState` de domínio → estado interno do hook.
   - `useMemo`/`useEffect` → permanecem no hook.
   - `useRef` para foco/DOM → expor o ref no retorno; componente faz `ref={...}`.
   - `fetch`, mutações, `router.refresh()` → callbacks do hook.
   - `toast.error` continua dentro do hook; `toast.success` é **proibido**.
3. Tipos (`UseFooListReturn`, `UseFooListArgs`) **co-localizados** no mesmo arquivo (export named).
4. Não importe `@/components/**` no hook (Invariant I2 do data-model).

Rode `bun run test:unit __tests__/unit/components/features/<feature>` — todos os testes devem passar (GREEN).

## Passo 5 — Refatorar o componente (IMPROVE)

Reduza o componente a:

```tsx
"use client";

import { useFooList } from "./hooks/use-foo-list";
import { /* shadcn ui */ } from "@/components/ui/...";
// ... outros imports apresentacionais

interface FooClientProps { /* ... */ }

export function FooClient({ initial }: FooClientProps) {
  const {
    items, sortedItems, isCreating, itemToDelete,
    handleNewClick, handleCreated, handleCancelled, handleRequestDelete,
    handleDeleteDialogChange, handleDeleted,
  } = useFooList(initial);

  return (
    <div>
      {/* JSX puro consumindo o retorno do hook */}
    </div>
  );
}
```

Cheque:

- ✅ Componente **não** importa nada de `@/lib/services/**` ou `@/lib/repositories/**` (exceto tipos).
- ✅ Componente **não** chama `fetch` diretamente.
- ✅ Componente **não** declara `useState`/`useEffect`/`useRef` para estado/efeito de domínio (`useForm()` do RHF é exceção — R4).
- ✅ Componente está abaixo de **200 LOC** (limite Princípio XII).

## Passo 6 — Cobertura

Confirme cobertura ≥ 80% nos hooks novos:

```bash
bun run test:unit -- --coverage src/components/features/<feature>/hooks
```

Se cobertura < 80%, adicione testes para branches descobertos (paths de erro, edge cases).

## Passo 7 — Smoke test manual da feature

Subir a aplicação e validar manualmente o fluxo crítico da feature:

```bash
bun run dev
```

Para Estúdios: criar, editar, excluir, tentar criar duplicado (validação 409), recarregar a página (server data sincronizado).

## Passo 8 — Verificar regressão integration + E2E

Apenas os testes da feature em questão (não roda a suíte completa em fase intermediária — Princípio XVI):

```bash
bun run test:integration -- studios   # ou narrators, editors, etc.
bun run test:e2e -- studios           # quando aplicável
```

Zero regressões esperadas.

## Passo 9 — Self-review checklist

Para cada componente refatorado, antes de commit:

- [ ] Hook não retorna JSX (Invariant I1).
- [ ] Hook não importa de `@/components/**` (I2).
- [ ] Componente não importa `@/lib/services/**` (I3).
- [ ] Componente fica < 200 LOC.
- [ ] Componente não tem `useEffect` de side-effect.
- [ ] Componente não chama `fetch`.
- [ ] Hook tem ≥ 80% cobertura.
- [ ] Nenhuma chamada `toast.success` introduzida.
- [ ] Comportamento observável idêntico ao anterior (smoke + suíte verde).

## Passo 10 — Fase final + PR

Antes de abrir PR (Princípio XVI — fase final única):

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e   # quando a feature toca fluxos E2E
bun run build
```

Tudo verde → abrir PR via `/finish-task` (ou `/prp-pr` se preferir).

---

## Cheat sheet — armadilhas comuns

| Armadilha | Sintoma | Correção |
|---|---|---|
| Hook retornando setState bruto | Componente faz `setItems((prev) => ...)` em uma callback do componente | Encapsular em `handleItemCreated` no hook |
| `useForm()` movido para o hook | TypeScript reclama de `Form {...form}` no componente | Manter `useForm()` no componente; hook recebe `form` (R4) |
| `firstFieldRef` declarado no componente | Componente ainda tem `useRef`/`useEffect` | Expor `firstFieldRef` do hook; componente apenas atribui ao `<Input ref={...}>` |
| `toast.success("Criado")` adicionado | Lint do projeto não pega ainda; revisor vai apontar | Remover. Sucesso = item aparecer na lista (Princípio VII) |
| Hook tipado como `(): any` | Cobertura passa, mas inferência quebra no consumidor | Sempre exportar `UseXxxReturn` named |
| Componente continua > 200 LOC após refatoração | Geralmente sub-componente embutido (como `StudioRowEditMode`) | Extrair para arquivo próprio dentro da pasta da feature |
| Testes do hook chamam `useRouter()` real | Erro em `renderHook` | `vi.mock("next/navigation", ...)` no topo do spec — único `vi.mock` permitido aqui (allowlist) |

---

## Referências cruzadas

- [spec.md](./spec.md) — visão de produto, user stories, success criteria, clarifications.
- [plan.md](./plan.md) — visão arquitetural, gates de constituição, project structure.
- [research.md](./research.md) — decisões R1–R8.
- [data-model.md](./data-model.md) — auditoria + critério estado domínio vs. visual.
- [contracts/](./contracts/) — referência canônica para hooks de Estúdios (P1).
- [.specify/memory/constitution.md](../../.specify/memory/constitution.md) — Princípios VII (Frontend), XII (Anti-padrões), XVI (Verificação).
- [CLAUDE.md](../../CLAUDE.md) — regras inline críticas.

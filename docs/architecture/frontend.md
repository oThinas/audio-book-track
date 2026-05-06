# Arquitetura — Frontend

> Visão geral de como o frontend está organizado. Para o padrão completo de hooks e contratos, ver [../hooks-pattern.md](../hooks-pattern.md).

## Princípios

- **Server Components primeiro**: páginas e layouts em `src/app/` carregam dados via `async/await` direto. `"use client"` apenas quando há interatividade.
- **Componentes UI puramente visuais**: primitivos shadcn/ui em `src/components/ui/` e componentes de layout em `src/components/layout/` não têm `useState` de domínio nem `fetch`.
- **Componentes client são apenas de renderização**: JSX + chamada de hook. Toda lógica vive em hooks customizados co-localizados (Princípio VII).

## Estrutura canônica de uma feature

Cada feature de domínio (`studios`, `narrators`, `editors`, `books`, `chapters`, `auth`, `settings`) segue a mesma forma:

```
src/components/features/<feature>/
├── <feature>-client.tsx        ← Wrapper client da listagem (consome hook de lista)
├── <feature>-table.tsx         ← Tabela presentacional parametrizada
├── <entity>-row.tsx            ← Linha em modo view (consome use-<entity>-row)
├── <entity>-row-edit-mode.tsx  ← Linha em modo edição (consome use-update-<entity>-form)
├── <entity>-new-row.tsx        ← Nova linha inline (consome use-create-<entity>-form)
├── delete-<entity>-dialog.tsx  ← Dialog de confirmação (consome use-delete-<entity>)
└── hooks/
    ├── use-<feature>-list.ts   ← Lista, filtros, alvo de dialog
    ├── use-<entity>-row.ts     ← Modo edição inline
    ├── use-create-<entity>-form.ts
    ├── use-update-<entity>-form.ts
    └── use-delete-<entity>.ts
```

### Onde colocar lógica nova

| Tipo de lógica | Onde mora |
|---|---|
| Listagem, filtros, paginação, alvo de dialog, status de mutação | Hook de feature (`hooks/use-<scope>.ts`) |
| Open/close de Popover/Tooltip controlado por composição Radix | Inline no componente |
| Hover, foco, valor temporário de input não-validado | Inline no componente |
| Dados que vêm do servidor | Server Component → passa por props ao componente client |
| Validação de form (RHF) | `useForm()` no componente; `onSubmit` no hook |

Critério detalhado em [../../specs/021-presentation-only-components/data-model.md §3](../../specs/021-presentation-only-components/data-model.md#3-estado-de-domínio-vs-estado-visual-local--critério-objetivo) e na constituição (Princípio VII).

## Localização de componentes

| Tipo | Diretório | Importação |
|---|---|---|
| Primitivos shadcn/ui | `src/components/ui/` | `@/components/ui/<name>` |
| Layout (PageContainer, Sidebar, etc.) | `src/components/layout/` | `@/components/layout/<name>` |
| Feature (moléculas de domínio) | `src/components/features/<feature>/` | `@/components/features/<feature>/<name>` |
| Hooks de feature | `src/components/features/<feature>/hooks/` | `@/components/features/<feature>/hooks/<name>` |
| Hooks de layout | `src/components/layout/hooks/` | `@/components/layout/hooks/<name>` |
| Hooks compartilhados (≥ 2 features) | `src/lib/hooks/` (criar quando surgir necessidade real) | `@/lib/hooks/<name>` |

**Proibido**: pastas `_components/` (ou variantes) dentro de `src/app/` — toda UI de feature DEVE morar em `src/components/features/<feature>/`.

## Referências

- [docs/hooks-pattern.md](../hooks-pattern.md) — receita reutilizável + contratos canônicos
- [.specify/memory/constitution.md](../../.specify/memory/constitution.md) — Princípio VII (Frontend) e XII (Anti-Padrões Frontend)
- [docs/architecture/backend.md](./backend.md) — espelho do backend (camadas, factories, repositories)
- [src/components/features/studios/](../../src/components/features/studios/) — feature de referência (US1)
# Data Model: Skeletons de Carregamento nas Rotas Autenticadas

**Feature**: 031-route-loading-skeletons | **Date**: 2026-06-04

## Entidades de domínio

**Nenhuma.** A feature é puramente de apresentação: não cria, altera ou lê entidades de domínio, tabelas, repositories ou services. Nenhuma migration.

## Contratos de componente (camada de apresentação)

Como não há dados persistentes, o "modelo" da feature são os contratos de props dos componentes de loading.

### `ListPageLoading` (`src/components/layout/page-loading.tsx`)

Moldura de listagem compartilhada pelas 4 rotas de lista. Server Component puro (zero estado, zero hooks).

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `title` | `string` | sim | Título real da página (ex.: "Livros") — renderizado em `<PageTitle>` |
| `description` | `string` | não | Descrição real — renderizada em `<PageDescription>`; omitida se ausente |
| `actionLabel` | `string` | não | Rótulo do botão de ação (ex.: "Novo Livro") — `<Button disabled>` com ícone `Plus`; omitido se ausente |
| `searchPlaceholder` | `string` | não | Placeholder real do campo de busca — `<Input disabled>`; campo omitido se ausente |
| `searchLabel` | `string` | não | `aria-label` da busca (obrigatória quando `searchPlaceholder` presente) |

**Invariantes**:

- Estrutura espelha exatamente a moldura dos `*-client.tsx`: `PageHeader` (título + descrição + botão) → busca → região da tabela.
- Região da tabela = **um único** `<Skeleton aria-hidden data-testid="page-loading-skeleton">` de altura fixa aproximada.
- Inclui exatamente **um** `<LoadingStatus>`.
- Todos os controles interativos renderizados com `disabled` — nenhum handler.

### `LoadingStatus` (`src/components/layout/page-loading.tsx`)

Região acessível de anúncio de carregamento. Reutilizada pelos `loading.tsx` de detalhe e settings.

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| — | — | — | Sem props. Renderiza `<div role="status" data-testid="page-loading-status">` + `<span class="sr-only">Carregando…</span>` |

**Invariantes**: exatamente uma ocorrência por estado de loading (FR-008: anúncio único por navegação).

### `Skeleton` (edição — `src/components/ui/skeleton.tsx`)

| Antes | Depois |
|-------|--------|
| `animate-pulse rounded-md bg-muted` | `animate-pulse motion-reduce:animate-none rounded-md bg-muted` |

**Invariante novo**: sob `prefers-reduced-motion: reduce`, nenhuma animação — bloco estático visível (FR-009). Vale para todos os usos existentes (dashboard, dialogs) sem mudança de API.

### Arquivos de rota (`loading.tsx` — default exports, sem props)

| Arquivo | Composição |
|---------|-----------|
| `books/loading.tsx` | `<PageContainer><ListPageLoading title="Livros" … /></PageContainer>` |
| `narrators/loading.tsx` | idem com strings de Narradores |
| `editors/loading.tsx` | idem com strings de Editores |
| `studios/loading.tsx` | idem com strings de Estúdios |
| `books/[id]/loading.tsx` | `<PageContainer>` + 3 barras `<Skeleton aria-hidden>` (título/meta/stats) + bloco único + `<LoadingStatus>` |
| `settings/loading.tsx` | `<PageContainer><PageHeader><PageTitle>Configurações</PageTitle></PageHeader>` + 2 blocos `<Skeleton aria-hidden>` + `<LoadingStatus>` |

## State transitions

N/A — `loading.tsx` é stateless; a transição loading → conteúdo é gerenciada pelo framework (Suspense boundary do App Router).

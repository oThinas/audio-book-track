# UI Contracts: Estados de Carregamento por Rota

**Feature**: 031-route-loading-skeletons | **Date**: 2026-06-04

A feature não expõe API REST — os contratos são de interface visual e acessibilidade, verificáveis por unit render tests e pelo E2E.

## Contrato comum (todas as rotas)

| Aspecto | Contrato |
|---------|----------|
| Anúncio AT | Exatamente 1 elemento `role="status"` com texto sr-only "Carregando…" (`data-testid="page-loading-status"`) |
| Blocos decorativos | Todo `<Skeleton>` com `aria-hidden="true"` — invisível para a árvore de acessibilidade |
| Tokens | Apenas classes semânticas (`bg-muted` via primitivo) — nenhum valor hardcoded |
| Movimento reduzido | Sob `prefers-reduced-motion: reduce`, blocos sem animação (estáticos, visíveis) |
| Interatividade | Zero handlers; controles renderizados com `disabled` |
| Layout | `<PageContainer>` como wrapper (consistência com a página real) |
| Test id do bloco principal | `data-testid="page-loading-skeleton"` no bloco da região de dados |

## Contrato por rota

### Listagens — `/books`, `/narrators`, `/editors`, `/studios`

| Região | Estado de loading | Página real |
|--------|-------------------|-------------|
| Título (`h1`) | **Real** (ex.: "Livros") | Idêntico |
| Descrição | **Real** | Idêntica |
| Botão de ação | **Real, `disabled`** (ícone + rótulo) | Idêntico, habilitado |
| Campo de busca | **Real, `disabled`** (placeholder + aria-label) | Idêntico, habilitado |
| Tabela | 1 bloco `<Skeleton>` (~altura da tabela) | Tabela real |

**Critério de aceite (unit)**: render de cada `loading.tsx` → `getByRole("heading", { name })` encontra o título real; `getByRole("status")` presente; botão e busca `disabled`; 1 bloco com testid presente.

### Detalhe do livro — `/books/[id]`

| Região | Estado de loading |
|--------|-------------------|
| Título | Barra `<Skeleton>` (~`h-9 w-64`) — título é dinâmico |
| Linha de meta (estúdio/preço) | Barra `<Skeleton>` (~`h-5 w-48`) |
| Linha de estatísticas | Barra `<Skeleton>` (~`h-5 max-w-md`) |
| Toolbar + tabela de capítulos | 1 bloco único `<Skeleton>` |

**Critério de aceite (unit)**: render → `getByRole("status")` presente; **nenhum** heading textual; 4 elementos skeleton `aria-hidden` (3 barras + 1 bloco).

### Configurações — `/settings`

| Região | Estado de loading |
|--------|-------------------|
| Título (`h1`) | **Real** — "Configurações" |
| Card Aparência | 1 bloco `<Skeleton>` |
| Seção widgets | 1 bloco `<Skeleton>` |

**Critério de aceite (unit)**: render → heading "Configurações" real; `getByRole("status")` presente; 2 blocos `aria-hidden`.

## Contrato E2E (mecanismo, rota representativa `/books`)

```text
Dado   operador logado em qualquer página autenticada
Quando o fetch RSC da navegação para /books é atrasado (interceptação, ~1.5s)
       e o operador clica no link "Livros"
Então  durante o atraso: heading "Livros" visível E page-loading-skeleton visível
E      após o atraso: page-loading-skeleton ausente E tabela (ou empty-state) visível
```

**Implementação de referência**: `page.route()` filtrando requests com header `RSC: 1` para a rota alvo; servidor `next start` de produção (prefetch ativo) — padrão do harness E2E existente.

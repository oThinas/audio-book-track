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
| Campo de busca | **Apenas `/books`**: real, `disabled` (placeholder + aria-label). Demais listagens não possuem busca — região omitida | Idêntico, habilitado (onde existe) |
| Tabela | 1 bloco `<Skeleton>` (~altura da tabela) | Tabela real |

**Critério de aceite (unit)**: render de cada `loading.tsx` → `getByRole("heading", { name })` encontra o título real; `getByRole("status")` presente; botão `disabled`; busca `disabled` presente **somente** em `/books` (ausente nas demais); 1 bloco com testid presente.

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
Dado   operador logado, prefetches RSC de /books abortados
       e cookie e2e-data-delay-ms=1500 presente
Quando o operador navega para /dashboard e clica no link "Livros"
Então  durante o atraso server-side: heading "Livros" visível E page-loading-skeleton visível
E      após o atraso: page-loading-skeleton ausente E tabela (ou empty-state) visível
```

**Implementação de referência**: atraso **server-side** na região de dados de `books/page.tsx` via `applyE2eDataDelay()` (`src/lib/e2e/data-delay.ts` — no-op sem `E2E_TEST_MODE=1` + cookie), com `page.route()` abortando os prefetches RSC (header `Next-Router-Prefetch`) para o segment cache não servir o conteúdo antes do clique; servidor `next start` de produção — padrão do harness E2E existente. Ver research R6 para o porquê da revisão (prefetch dinâmico do Next 16 invalidou o atraso por interceptação de rede).

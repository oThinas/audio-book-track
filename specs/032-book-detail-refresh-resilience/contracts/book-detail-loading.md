# Contract: Book Detail Loading State (`/books/[id]`)

**Feature**: 032-book-detail-refresh-resilience | **Date**: 2026-06-10

Contrato de UI do estado de carregamento da rota de detalhe do livro. Restaura a US2 da 031 (commit `d4154de`) sob a moldura `loading.tsx` do Next.js App Router. Reusa primitivos existentes — **nenhuma dependência nova** (FR-009).

## Arquivo

`src/app/(authenticated)/books/[id]/loading.tsx` — Server Component (sem `use client`).

> A listagem vive em `src/app/(authenticated)/books/(list)/` (route group criado na 031 para escopar o boundary da listagem). O `loading.tsx` do detalhe entra em `books/[id]/` e **não** afeta a listagem.

## Estrutura visual (silhueta de `book-header.tsx` + região de capítulos)

- Wrapper: `<PageContainer>`.
- Cabeçalho: **3 barras de skeleton** estruturadas, todas `aria-hidden="true"`:
  1. título (`h-9 w-64`)
  2. linha de meta / estúdio (`h-5 w-48`)
  3. linha de estatísticas (`h-5 max-w-md`)
- Região da toolbar + tabela de capítulos: **1 bloco único** de skeleton `aria-hidden="true"` com `data-testid="page-loading-skeleton"` (`h-96 w-full`).
- Anúncio acessível: `<LoadingStatus />` (de `@/components/layout/page-loading`) — região `role="status"` única ("Carregando…").

## Regras (FR-007 / FR-008 / FR-009)

| Regra | Detalhe |
|---|---|
| Sem heading textual | O título é dinâmico (nome do livro) → **nenhum** `<h1>`/heading no loading (diferente das listagens, que têm título estático). |
| Anúncio único | Exatamente **uma** região `role="status"` por navegação. |
| Blocos decorativos ocultos | Todo `Skeleton` com `aria-hidden="true"` — fora da árvore de acessibilidade. |
| Dark mode por construção | `Skeleton` usa apenas tokens semânticos do design system. |
| Movimento reduzido | A animação respeita `motion-reduce:` (ajuste já no primitivo `Skeleton`, herdado da 031). |
| Sem dependência nova | Reusa `PageContainer`, `LoadingStatus`, `Skeleton`. |

## Comportamento sob streaming (Next.js)

Confirmado via Context7 (`/vercel/next.js`):

- Ao navegar para `/books/[id]`, o `page.tsx` faz `await` nos serviços → o `loading.tsx` renderiza como fallback do segmento → o servidor **commita HTTP 200** e inicia o streaming do HTML.
- Quando os dados chegam, o conteúdo real (`BookDetailClient`) substitui o fallback sem salto de layout (CLS < 0.1 por construção da silhueta).
- **Livro inexistente**: `notFound()` dispara **mid-stream** (após o `await`) → o status já está commitado em 200; o Next injeta `<meta name="robots" content="noindex">` e renderiza o `not-found.tsx` (`data-testid="not-found-message"`, `<h1>404</h1>`) no cliente. **O status HTTP da navegação é 200, não 404.**

## Impacto em testes E2E (FR-010)

| Spec | Ajuste |
|---|---|
| `books-detail.spec.ts` → "returns 404 page for unknown book id" | Em vez de `expect(response?.status()).toBe(404)`, aguardar e afirmar a UI: `await expect(page.getByTestId("not-found-message")).toBeVisible()`. (Renomear o título do teste para refletir a UI, ex.: "renders the not-found page for unknown book id".) |
| `chapters-table-scroll.spec.ts` | Antes de medir `clientHeight/scrollHeight/boundingBox`, aguardar `await expect(page.getByTestId("chapter-row-…").first()).toBeVisible()` — o conteúdo entra no DOM oculto antes do swap do Suspense. |

## Verificação (unit)

`__tests__/unit/app/route-loading-states.spec.tsx` — restaurar o describe `"/books/[id] loading state"` (de `d4154de`):

- renderiza **nenhum** heading textual (título dinâmico);
- renderiza exatamente **uma** região `role="status"`;
- renderiza exatamente **um** bloco `data-testid="page-loading-skeleton"` com `aria-hidden="true"`;
- (cabeçalho) renderiza as 3 barras de skeleton estruturadas `aria-hidden`.

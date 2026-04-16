# Research: Pagina 404 Personalizada

**Branch**: `014-custom-404-page` | **Date**: 2026-04-16

## Decision Log

### D1: Mecanismo de pagina 404 no Next.js App Router

**Decision**: Usar `not-found.tsx` no nivel raiz (`src/app/not-found.tsx`) — a convencao nativa do Next.js App Router para paginas 404.

**Rationale**: O App Router automaticamente renderiza `not-found.tsx` quando uma rota nao e encontrada. Ao colocar no nivel raiz, todas as rotas inexistentes sao capturadas, independentemente de estarem dentro de `(auth)` ou `(authenticated)`. O arquivo renderiza dentro do `RootLayout`, que ja inclui o `ThemeProvider` (dark/light mode) e as fontes.

**Alternatives considered**:
- `not-found.tsx` dentro de `(authenticated)/` — cobriria apenas rotas autenticadas, nao capturando 404s em rotas publicas.
- Middleware redirect — desnecessario; o mecanismo nativo e suficiente.

### D2: Selecao aleatoria de mensagens

**Decision**: Usar `Math.random()` diretamente no Server Component. Como o componente e renderizado no servidor a cada request, cada visita recebe uma mensagem potencialmente diferente.

**Rationale**: Server Components do Next.js sao renderizados a cada request por padrao (sem cache estatico para `not-found.tsx`). Nao e necessario `use client` ou state management — a aleatoriedade no servidor e suficiente.

**Alternatives considered**:
- `useState` com `useEffect` no cliente — adicionaria complexidade desnecessaria e exigiria `use client`.
- Componente estatico com uma unica mensagem — nao atende ao FR-006 (conjunto minimo de 5 frases).

### D3: Navegacao de retorno

**Decision**: Usar componente `<Button>` do shadcn/ui com `asChild` e `<Link>` do Next.js para navegacao de volta ao dashboard.

**Rationale**: Segue a convencao do projeto (nunca usar `<button>` ou `<a>` HTML cru). O `Link` do Next.js garante client-side navigation sem full page reload.

**Alternatives considered**:
- `<a href="/">` — proibido pela constituicao (anti-padrao: HTML cru).
- `useRouter().push()` — requer `use client` desnecessariamente.

### D4: Layout da pagina (nao-autenticada)

**Decision**: Nao usar `<PageContainer>` nem componentes de layout autenticado. A pagina 404 e standalone, renderizada diretamente dentro do `RootLayout`.

**Rationale**: `<PageContainer>` e obrigatorio apenas para paginas autenticadas (constituicao VII). A 404 e acessivel sem autenticacao e nao tem sidebar. O layout sera um container centralizado vertical e horizontalmente usando Flexbox.

**Alternatives considered**:
- Usar sidebar na 404 — inadequado pois o usuario pode nao estar autenticado.

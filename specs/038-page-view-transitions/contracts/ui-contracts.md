# Phase 1 — UI / Behavioral Contracts

**Feature**: 038-page-view-transitions

> Esta feature não expõe nenhuma API REST nova. Os contratos abaixo são de **comportamento de UI**: o vocabulário de transition types, o contrato CSS das classes de view-transition, e o contrato da rota interceptada do modal. São verificados por testes unit (helper) e E2E (fluxos).

---

## C1. Contrato do helper `resolveNavTransition`

`src/lib/navigation/nav-transition.ts` (função pura, unit-testada a 100%).

```ts
export type NavTransitionType =
  | "nav-up"
  | "nav-down"
  | "depth-forward"
  | "depth-back"
  | "none";

export function resolveNavTransition(fromPath: string, toPath: string): NavTransitionType;
```

**Regras (ordem de avaliação):**

| # | Condição | Resultado |
|---|----------|-----------|
| 1 | `toPath` é descendente de `fromPath` (prefixo por segmento, ex.: `/books` → `/books/123`) | `depth-forward` |
| 2 | `toPath` é ancestral de `fromPath` (ex.: `/books/123` → `/books`) | `depth-back` |
| 3 | Ambos são itens de topo (`NAV_ITEMS`) e `index(to) > index(from)` | `nav-down` |
| 4 | Ambos são itens de topo e `index(to) < index(from)` | `nav-up` |
| 5 | `fromPath === toPath` ou qualquer outro caso | `none` |

**Casos de teste obrigatórios (unit):**

| from | to | esperado | porquê |
|------|----|----------|--------|
| `/dashboard` | `/books` | `nav-down` | idx 0 → 1 |
| `/books` | `/dashboard` | `nav-up` | idx 1 → 0 |
| `/dashboard` | `/narrators` | `nav-down` | idx 0 → 4 |
| `/narrators` | `/studios` | `nav-up` | idx 4 → 2 |
| `/books` | `/books/123` | `depth-forward` | descendente |
| `/books/123` | `/books` | `depth-back` | ancestral |
| `/books/123` | `/studios` | `none` | nem irmão de topo nem profundidade direta |
| `/books` | `/books` | `none` | mesma rota |
| `/dashboard` | `/settings` | `none` | settings é modal/BOTTOM_ITEMS, fora do eixo vertical |

> A função NÃO consulta o histórico do navegador (FR-017): a direção é puramente função do par de rotas.

---

## C2. Contrato CSS — view-transition classes

Mapeamento `transition type → view-transition-class → keyframes`. Definido em `src/app/globals.css`. Direcionais: **slide de viewport inteiro (100%), apenas `transform`, sem fade** (push estilo mobile). Neutro: `opacity` (FR-013). Tokens em custom properties (D8).

| Type | `::view-transition-old` (saindo) | `::view-transition-new` (entrando) |
|------|----------------------------------|-------------------------------------|
| `nav-down` | desliza 100% para cima | entra de baixo (100% → 0) |
| `nav-up` | desliza 100% para baixo | entra de cima (-100% → 0) |
| `depth-forward` | desliza 100% para a esquerda | entra pela direita (100% → 0) |
| `depth-back` | desliza 100% para a direita | entra pela esquerda (-100% → 0) |
| `none` (default) | fade out (opacity) | fade in (crossfade neutro) |

Tokens: `--vt-duration` (350ms, ≤ 400ms), `--vt-ease`. Sem `--vt-slide-offset` (offset é sempre 100%). `::view-transition-group(*) { overflow: clip }` contém o slide na área de conteúdo (sidebar estável).

**Contrato de aplicação no `<ViewTransition>`** (slot de conteúdo em `layout-client.tsx`) — prop `default` (navegação de rota = "update" do boundary persistente; ver nota D1):

```tsx
<ViewTransition
  default={{ "nav-up": "nav-up", "nav-down": "nav-down", "depth-forward": "depth-forward", "depth-back": "depth-back", default: "vt-crossfade" }}
>
  {children}
</ViewTransition>
```

**Contrato nos `<Link>`** (sidebar e mobile-sidebar):

```tsx
const pathname = usePathname();
// por item:
<Link href={item.href} transitionTypes={[resolveNavTransition(pathname, item.href)]}>…</Link>
```

**Contrato de reduced-motion** (global, FR-006):

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation-duration: 0s !important; animation-delay: 0s !important; }
}
```

---

## C3. Contrato da rota modal de /settings (parallel + intercepting)

| Caminho | Papel | Comportamento |
|---------|-------|---------------|
| `src/app/(authenticated)/@modal/default.tsx` | slot vazio | retorna `null` quando nenhuma rota interceptada está ativa |
| `src/app/(authenticated)/@modal/(.)settings/page.tsx` | interceptação | renderiza o conteúdo de settings dentro de `<Dialog>` (overlay cobre a aplicação) |
| `src/app/(authenticated)/settings/page.tsx` | página standalone | deep-link/refresh renderiza a página cheia (sem fundo) |
| `src/app/(authenticated)/layout.tsx` | host do slot | aceita prop `modal` e a renderiza ao lado de `children` |

**Comportamento observável (E2E):**

1. Navegação client-side para `/settings` (via link/sidebar) → abre `<Dialog>` sobre a página atual; URL = `/settings`.
2. Fechar (botão / Esc / clique no overlay) → modal some, retorna à página de origem com a URL anterior.
3. Com o modal aberto, a sidebar está coberta pelo overlay → não clicável; navegar exige fechar primeiro (FR-016).
4. `back` do navegador com modal aberto → fecha o modal (volta à origem).
5. Deep-link/refresh em `/settings` → página standalone renderizada (FR-011).

**Reuso de conteúdo**: página e modal consomem `src/components/features/settings/settings-content.tsx` (seções `ThemeSelector`, `FontSizeSelector`, `FavoritePageSelector`, `PrimaryColorSelector`, `DashboardWidgetsSection`); a busca de preferências permanece no Server Component.

---

## C4. Contrato do morph de reordenação (US5)

- Corpo da lista de capítulos (`chapters-table.tsx`) envolto em `<ViewTransition>`; `key={chapter.id}` estável.
- `use-chapters-reorder.ts`: `apply`/`moveBy` executam a atualização otimista de ordem dentro de `startTransition` → React anima o reposicionamento.
- Sob reduced-motion: reposiciona instantâneo (via bloco C2).
- Contrato de não-regressão: persistência (`expectedVersion`/409) inalterada; classes de presença da feature 037 (`ROW_ENTER_CLASS`/`ROW_EXIT_CLASS`) coexistem (gatilhos distintos: presença ≠ reposicionamento).

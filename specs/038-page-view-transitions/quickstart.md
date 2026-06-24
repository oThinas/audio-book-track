# Phase 1 — Quickstart: Animações de transição entre páginas

**Feature**: 038-page-view-transitions

Guia rápido para habilitar e validar a feature. Detalhes e justificativas em [research.md](./research.md); contratos em [contracts/ui-contracts.md](./contracts/ui-contracts.md).

## Pré-requisitos (já satisfeitos)

- Next.js 16.2.1 (suporta `experimental.viewTransition`).
- React 19.2.4 (expõe `<ViewTransition>` e `addTransitionType`).
- `loading.tsx` presentes em books(list), books/[id], studios, editors, narrators, settings (feature 031). **Dashboard não tem** — sem janela de skeleton ali.
- Reorder de capítulos funcional (`@dnd-kit` + ↑/↓, feature 026).
- `reactCompiler: true` em `next.config.ts` — validar coexistência via build.

## Passos de habilitação (ordem sugerida; TDD por etapa)

1. **Flag**: adicionar `experimental: { viewTransition: true }` em `next.config.ts` (preservar `reactCompiler` e o wrap do Sentry).
2. **Helper de direção** (TDD primeiro): `src/lib/navigation/nav-transition.ts` + `__tests__/unit/navigation/nav-transition.spec.ts` (casos da tabela C1, cobertura 100%).
3. **Wrap do conteúdo**: envolver `{children}` em `layout-client.tsx` com `<ViewTransition>` (mapeamento de tipos do contrato C2). Sidebar fica fora — não anima.
4. **Tipos nos links**: `transitionTypes={[resolveNavTransition(usePathname(), item.href)]}` em `sidebar.tsx` e `mobile-sidebar.tsx`. Links de conteúdo lista→detalhe e o "voltar" da página de detalhe recebem `depth-forward`/`depth-back`.
5. **CSS** em `globals.css`: tokens (`--vt-*`), keyframes por classe (C2), e bloco `@media (prefers-reduced-motion: reduce)`.
6. **Modal /settings**: extrair `settings-content.tsx`; criar `@modal/default.tsx` (null) e `@modal/(.)settings/page.tsx` (`<Dialog>`); ajustar `layout.tsx` para aceptar `modal`. Confirmar/adicionar `Dialog` shadcn (`bunx --bun shadcn@latest add dialog`). Consultar `design.pen` via Pencil MCP antes de montar a tela do modal.
7. **Morph de reorder**: envolver o corpo da lista em `chapters-table.tsx` com `<ViewTransition>`; envolver o update otimista de `use-chapters-reorder.ts` em `startTransition`.
8. **Spikes** (isolados, com fallback): D3 (direção em back/forward do navegador) e D6 (coexistência `@dnd-kit` × morph).

## Validação (Definition of Done — mapeada às SCs)

- **E2E navegação** (SC-001/SC-009): navegar todas as seções de topo e lista↔detalhe; conferir eixo/sentido correto e sidebar estável; sem erro de console.
- **Reduced motion** (SC-002): com `prefers-reduced-motion: reduce`, troca instantânea sem animação.
- **Degradação** (SC-002/FR-007): navegador sem suporte → troca instantânea, sem erro.
- **Acessibilidade** (SC-004): foco de teclado correto após transição; navegação por teclado intacta.
- **Modal** (SC-005): abre sobre a página (overlay cobre sidebar), URL `/settings`, fecha e restaura; deep-link/refresh = página standalone.
- **Reorder** (SC-006): linhas animam reposicionamento; ordem persistida.
- **Regressão visual** (SC-007): screenshots 320/768/1024/1440 em light e dark, sem diferença além das animações.
- **Build** (SC-008): `bun run build` compila sem erros com a flag ligada (smoke test do React Compiler).

## Verificação final (antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:e2e
bun run build
```

(Integration: N/A — sem mudança de DB.)

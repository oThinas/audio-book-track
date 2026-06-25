# Contract: snapshot Lighthouse do modal de configuração (D8)

Estende `scripts/diagnostics/lighthouse.ts` (script de diagnóstico — não é API de produção).

## Fluxo

1. `puppeteer-core` `connect({ browserURL: http://localhost:${DIAGNOSE_DEBUG_PORT} })` (mesmo
   CDP aberto pelo Playwright; default 9222).
2. **Viewport desktop**: `page.setViewport({ width: 1280, height: 800 })` (≥ 1024px) **antes**
   de navegar/clicar — a sidebar com `[data-testid="sidebar"]` é **desktop-only**
   (`hidden md:flex` em `sidebar.tsx`); abaixo de 768px o `<aside>` fica `display:none` e o
   clique falharia.
3. `page.setCookie(...)` com os cookies de sessão do admin já extraídos no fluxo existente.
4. `page.goto(${baseURL}/dashboard)` (rota autenticada).
5. Clicar em `[data-testid="sidebar"] a[href="/settings"]` (rótulo "Configurações") → dispara
   a rota interceptada `@modal/(.)settings` → `SettingsModal` (Dialog) abre.
6. `const flow = await startFlow(page); await flow.snapshot();`
7. Escrever em `.lighthouse/`: `settings-modal.html` (`flow.generateReport()`) e
   `settings-modal.json` (`flow.createFlowResult()`).

## Requisitos do contrato

- DEVE gerar um relatório de snapshot do modal — FR-009.
- DEVE abrir o modal pela navegação real (link da sidebar), não por `goto('/settings')` — FR-010.
- NÃO DEVE mais emitir o `console.warn` de "Skipped settings-modal snapshot" — FR-011.
- Em falha (link/modal não encontrado), DEVE logar e **continuar** sem abortar os demais
  audits — FR-012 (mesmo padrão do skip de `/books/:id`).
- `puppeteer-core` é **devDependency** — fora do bundle de produção.

## Verificação

- `bun run diagnose:lighthouse` produz `.lighthouse/settings-modal.html` + `.json` e **não**
  imprime o warning de skip — SC-004.

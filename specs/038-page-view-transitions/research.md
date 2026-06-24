# Phase 0 — Research: Animações de transição entre páginas (View Transitions)

**Feature**: 038-page-view-transitions
**Date**: 2026-06-23
**Fontes primárias (Context7, version-specific)**: Next.js `/vercel/next.js/v16.2.2` (docs `viewTransition`, `Link`, `parallel-routes`, `intercepting-routes`), React `/reactjs/react.dev` (`ViewTransition`, `addTransitionType`).

> Todas as decisões abaixo foram confirmadas na documentação atualizada via Context7 MCP (a feature depende de APIs experimentais; consulta obrigatória conforme pedido explícito do usuário).

---

## D1. Mecanismo de transição entre rotas

**Decision**: Habilitar `experimental.viewTransition: true` no `next.config.ts` e envolver **apenas o slot de conteúdo** (`{children}` do `layout-client.tsx`) em `<ViewTransition>` (importado de `react`). A direção é selecionada por **transition types** aplicados via `transitionTypes` no `<Link>` (que o Next.js repassa para `React.addTransitionType`), mapeados para classes de view-transition no `enter`/`exit` do `<ViewTransition>` e estilizados por keyframes CSS em `globals.css`.

**Rationale**:
- A doc do Next.js confirma: *"route navigations are transitions, so `<ViewTransition>` animations activate automatically during navigation"* — ou seja, a navegação client-side do App Router dispara a transição automaticamente; não há `startTransition` manual para a troca de rota.
- CSS puro (`@view-transition { navigation: auto }`) **não** serve: só dispara em navegação cross-document (full reload). A navegação do App Router é SPA → o caminho obrigatório é o componente React `<ViewTransition>`.
- Envolver só o `{children}` (e não o root layout) mantém a **sidebar fora** do snapshot de transição. Como o layout persiste entre rotas no App Router, o DOM da sidebar é estável → não pisca/anima (FR-001). Confirmado pela estrutura atual: em `src/app/(authenticated)/layout-client.tsx` a `<Sidebar>` fica fora do `<div className="flex-1 overflow-auto bg-background">{children}</div>`.

**Alternatives considered**:
- *CSS-only `@view-transition`*: rejeitado — não funciona em navegação SPA.
- *Wrap no root layout*: rejeitado — capturaria a sidebar e exigiria `view-transition-name` extra para isolá-la; o wrap no slot de conteúdo é mais simples (Princípio IV).
- *Lib de animação (Framer Motion/`AnimatePresence`)*: rejeitado — adicionaria dependência de cliente (Princípio VIII proíbe sem justificativa) e não dá o handoff nativo skeleton→conteúdo do Suspense.

**Nota de implementação (T004)**: a doc oficial do React ("Customizing navigation animations") usa a prop **`default={{ type: classe, default: classe-neutra }}`** para navegação de rota — o boundary persiste e seu conteúdo é **atualizado** (kind "update"), não montado/desmontado, então `enter`/`exit` não disparam. O contrato C2 mencionava `enter`/`exit` como aproximação; a implementação usa `default`, que é o caminho documentado e cobre o update + fallback `vt-crossfade` para tipos não mapeados (`none`).

---

## D2. Vocabulário de transition types e resolução de direção

**Decision**: Definir 4 transition types + neutro, resolvidos por um **helper puro** a partir do par (rota de origem, rota de destino):

| Type | Quando | Animação (compositor-friendly) |
|------|--------|-------------------------------|
| `nav-down` | seção de topo → seção de topo de **índice maior** no menu | novo entra de baixo / antigo sai para cima (eixo Y) |
| `nav-up` | seção de topo → seção de topo de **índice menor** no menu | novo entra de cima / antigo sai para baixo (eixo Y) |
| `depth-forward` | lista → detalhe (destino é descendente da origem) | novo entra pela direita / antigo sai para a esquerda (eixo X) |
| `depth-back` | detalhe → lista (destino é ancestral da origem) | novo entra pela esquerda / antigo sai para a direita (eixo X) |
| `none` (default) | qualquer caso não classificado | crossfade neutro (sem deslocamento direcional) |

Helper puro `resolveNavTransition(fromPath, toPath)` (em `src/lib/navigation/nav-transition.ts`):
1. **Profundidade primeiro**: se `toPath` é descendente de `fromPath` (prefixo de segmento) → `depth-forward`; se ancestral → `depth-back`.
2. **Irmãos de topo**: se ambos resolvem para itens de `NAV_ITEMS` (`src/lib/constants/navigation.ts`), comparar índices → maior = `nav-down`, menor = `nav-up`.
3. Caso contrário → `none`.

**Rationale**:
- A doc do Next confirma que `transitionTypes` repassa a lista para `React.addTransitionType` durante a navegação, e o `<ViewTransition enter={{ 'tipo': 'classe' }}>` aplica a classe correspondente (confirmado na doc do React `addTransitionType`). Isso permite um único `<ViewTransition>` no slot de conteúdo reagindo a múltiplas direções.
- A direção depende de **origem + destino** (decisão de Clarify: "pela relação entre as rotas, não pelo histórico"). Como `transitionTypes` é estático por `<Link>`, resolvemos dinamicamente: cada `<Link>` da sidebar computa seu type com `resolveNavTransition(usePathname(), item.href)`. A sidebar re-renderiza a cada mudança de rota, então o type fica sempre fresco relativo à posição atual.
- Helper puro = testável a 100% em unit test (Princípio V), sem DB.
- A ordem canônica do menu (`NAV_ITEMS`: dashboard→books→studios→editors→narrators) passa a ser **comportamento observável** (FR-002, Assumption registrada na spec). `settings` é `BOTTOM_ITEMS` e vira modal (D4) → não participa do eixo vertical.

**Alternatives considered**:
- *`transitionTypes` fixo por link* (ex.: todos os links da sidebar = `nav-forward`): rejeitado — não distingue subir/descer no menu, contraria a decisão de Clarify.
- *Direção só por histórico do navegador* (popstate=back): rejeitado explicitamente em Clarify.

---

## D3. Back/forward do navegador (popstate) — RISCO PRINCIPAL

**Decision**: A resolução de direção via `transitionTypes` cobre navegações originadas de `<Link>`/`router` (sidebar + links de conteúdo) — que são a grande maioria e cobrem todos os fluxos primários. Para **back/forward do navegador** (popstate), `transitionTypes` não se aplica; o comportamento-alvo (direção pela relação de rotas, FR-017 / cenário de aceitação US1.2) será resolvido por um **spike** durante a implementação, com **fallback documentado** = crossfade neutro (`default`) em back/forward até o spike confirmar uma técnica estável.

**Rationale / opções a spikar**:
- Next.js dispara view transition em back/forward, mas não há API documentada para injetar transition type nesse caminho.
- Opção A (preferida no spike): um pequeno listener client-side (Navigation API / `popstate`) que chama `React.addTransitionType` antes do commit da navegação, derivando o type do par (pathname anterior, novo). Risco: timing relativo ao `startTransition` interno do App Router.
- Opção B (fallback): aceitar crossfade neutro em back/forward — degradação aceitável, sem regressão funcional. Atende FR-003/FR-007.
- Esta é a única incerteza técnica relevante; isolá-la em spike evita travar o restante (Princípio IV).

**Alternatives considered**: forçar todo back para `depth-back`/`nav-up` — rejeitado por ser impreciso (back pode ir para um irmão de índice maior).

**Conclusão do spike (T012)** — escolhida a **Opção B (fallback neutro)**:
- `addTransitionType` só é válido **dentro** de uma transition do React. Num handler cru de `popstate` (que dispara após a URL já ter mudado e fora da transition interna do App Router) a chamada emitiria o aviso "addTransitionType can only be called inside a transition" → erro de console, regressão direta de FR-007/SC-002.
- A Navigation API com `intercept()` assumiria o controle da navegação e conflitaria com o roteador do App Router (risco alto, fora do escopo best-effort).
- Comportamento atual **já correto e sem regressão**: navegações por back/forward não passam por `<Link>`, então nenhum transition type é adicionado e o boundary usa a classe `vt-crossfade` do `default` → crossfade neutro limpo, sem erro, com degradação graciosa quando a API está ausente.
- **Resultado**: zero código adicional; back/forward = crossfade neutro (best-effort, conforme FR-017/SC-009). Caso uma API estável para injetar o tipo em traversals surja em versão futura do Next/React, é um aprimoramento isolado que não muda o contrato.

---

## D4. /settings como modal (parallel + intercepting routes)

**Decision**: Implementar com **Parallel Route** `@modal` + **Intercepting Route** `(.)settings`, padrão oficial do Next.js para "modal com URL compartilhável":
- `src/app/(authenticated)/@modal/(.)settings/page.tsx` — renderiza o conteúdo de configurações dentro de um `<Dialog>` (shadcn/ui) com overlay cobrindo a aplicação (FR-009).
- `src/app/(authenticated)/@modal/default.tsx` — retorna `null` (slot vazio quando não interceptado).
- `src/app/(authenticated)/layout.tsx` passa a aceitar a prop `modal` e renderizá-la ao lado de `children`.
- `src/app/(authenticated)/settings/page.tsx` permanece como **página independente** para deep-link/refresh (FR-011).

**Rationale**:
- Doc do Next confirma que Intercepting + Parallel Routes resolvem exatamente: conteúdo do modal **compartilhável por URL**, **preservação de contexto no refresh** (renderiza a página cheia), **fecha no back**, **reabre no forward** — que é o comportamento descrito na spec (US4) e no exemplo react-view-transitions citado.
- O overlay do `<Dialog>` cobre a sidebar (FR-009/FR-016): com o modal aberto, a navegação pela sidebar não é acessível; fechar (botão, Esc, clique no overlay) retorna à origem (FR-010).
- Reuso do conteúdo: extrair as seções de configuração de `settings/page.tsx` para um componente compartilhado (`src/components/features/settings/settings-content.tsx`) consumido tanto pela página quanto pelo modal — evita duplicação (DRY), mantém a busca de preferências no Server Component.

**Alternatives considered**:
- *Modal por estado client + `window.history.pushState`* (shallow routing): rejeitado — não dá deep-link real nem SSR da página em refresh sem duplicar lógica; intercepting routes é o padrão nativo.
- *Modal sem mudar URL*: rejeitado — contraria o requisito de URL `/settings` compartilhável.

**A verificar na implementação**: existência de `src/components/ui/dialog.tsx` (shadcn). Se ausente, adicionar com `bunx --bun shadcn@latest add dialog` (Princípio VII).

---

## D5. Handoff skeleton → conteúdo (Suspense)

**Decision**: O handoff suave aproveita os `loading.tsx` existentes (feature 031). Como o `<ViewTransition>` envolve o slot de conteúdo, a troca do fallback de Suspense (skeleton) para o conteúdo resolvido ocorre dentro do mesmo boundary e anima como crossfade (`default` ou classe dedicada). Não criar novos skeletons.

**Rationale**:
- `loading.tsx` presentes em books(list), books/[id], studios, editors, narrators, settings. **Dashboard não tem `loading.tsx`** → sem janela de skeleton perceptível ali (apenas a transição direcional de D1 se aplica; coerente com US2 cenário 2).
- O crossfade skeleton→conteúdo é o comportamento default do `<ViewTransition>` quando o conteúdo do boundary muda; nenhuma marcação extra obrigatória além de garantir que o boundary englobe tanto o fallback quanto o conteúdo.

**Alternatives considered**: animar cada skeleton manualmente — rejeitado (Princípio IV); o boundary único já cobre.

**Confirmação de implementação (T014)**: nenhuma mudança de código foi necessária. Tanto a navegação de rota quanto o reveal do Suspense são "update" do mesmo boundary persistente, distinguidos pelo transition type — a navegação adiciona um tipo (direcional, via `transitionTypes`/`addTransitionType`); o reveal skeleton→conteúdo não adiciona tipo, então usa a classe `vt-crossfade` da chave `default`. Resultado: entrada direcional do skeleton + handoff em crossfade, sem `update` explícito. Skeleton já expõe `data-testid="page-loading-skeleton"` (`LoadingBlock`).

---

## D6. Morph de reordenação de capítulos (US5)

**Decision**: Envolver a lista de linhas de capítulo (corpo da tabela em `chapters-table.tsx`) em `<ViewTransition>` e executar a reordenação otimista dentro de `startTransition` no hook `use-chapters-reorder.ts`. As linhas têm `key={chapter.id}` (estável) → React anima o reposicionamento automaticamente.

**Rationale**:
- Doc do React confirma o padrão exato: lista envolta em `<ViewTransition>` + reorder dentro de `startTransition` → morph automático por key estável.
- O `useChaptersReorder` já faz update otimista (`setOrderedChapters(optimistic)`); basta envolvê-lo em `startTransition` para o React capturar o morph.
- Sob `prefers-reduced-motion`, o bloco CSS global (D7) zera a duração → reposiciona instantâneo (US5 cenário 2).

**RISCO / a validar no spike de D6**: conflito entre o `transform` do `@dnd-kit` (aplicado durante o arraste em `chapter-row.tsx`) e o morph do `<ViewTransition>` no commit do drop. O `@dnd-kit` cuida do movimento **durante** o arraste; o `<ViewTransition>` deve animar o **assentamento pós-drop** e os movimentos via botões ↑/↓. Validar que não há "duplo movimento" ou salto. Linhas já carregam classes de enter/exit da feature 037 (`ROW_ENTER_CLASS`/`ROW_EXIT_CLASS`); confirmar que coexistem com o morph (são gatilhos distintos: presença vs. reposicionamento).

**Conclusão do spike (T028)** — implementado conforme o padrão documentado do React: **cada linha** envolta em `<ViewTransition key={chapter.id}>` (envolver só o container faria crossfade do todo, não morfa linhas — confirmado na doc) + update otimista (`apply`/`moveBy`) dentro de `startTransition`. O reposicionamento usa a **animação default do browser** para o grupo (morph de posição) — sem CSS custom (T031); reduced-motion já zera via T017.
- **Coexistência com `@dnd-kit`**: o `@dnd-kit` controla o movimento **durante** o arraste (transform inline na `<TableRow>`); o morph do `<ViewTransition>` anima o **commit** (botões ↑/↓ — caminho limpo — e o assentamento pós-drop). Não há mudança na lógica de reorder nem na persistência (`expectedVersion`/409), então **não há regressão funcional** — apenas `view-transition-name` por linha + `startTransition` foram adicionados.
- **A validar em navegador** (consolidado em T036/manual, DB indisponível nesta sessão): qualidade visual do drag-drop (possível "duplo movimento" entre o drop do dnd-kit e o morph) e quirks de `view-transition-name` em `display: table-row`.
- **Fallback documentado** se o drag-drop ficar ruim: escopar o morph aos ↑/↓ (suprimir `view-transition-name` durante arraste ativo) ou remover o wrapper por linha — nenhum altera função. As classes de presença da 037 coexistem (gatilhos distintos).

---

## D7. Reduced motion e degradação graciosa

**Decision**:
- **Reduced motion**: adicionar bloco CSS global em `globals.css` zerando animações de view-transition:
  ```css
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-group(*),
    ::view-transition-old(*),
    ::view-transition-new(*) {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
    }
  }
  ```
- **Sem suporte**: navegadores sem View Transitions API simplesmente trocam o conteúdo instantaneamente — o React `<ViewTransition>` degrada para render normal sem erro. Nenhum polyfill.

**Rationale**:
- Consistente com o padrão do projeto (reduced-motion via `motion-reduce:` por componente + `matchMedia` em `use-row-presence.ts`); para pseudo-elementos `::view-transition-*` (não alcançáveis por utilitários Tailwind) o bloco `@media` cru é o caminho correto.
- Suporte de navegador (Assumption da spec): Chromium 111+ e Safari 18+ animam; Firefox e demais → troca instantânea (degradação graciosa, FR-007).

**Alternatives considered**: polyfill de View Transitions — rejeitado (peso de bundle, Princípio VIII; degradação instantânea é aceitável).

---

## D8. Tokens de animação e modelo de slide

**Decision**: Duração e curva como **CSS custom properties** (`--vt-duration: 350ms; --vt-ease`) em `globals.css`, alvo ≤ 400 ms (NFR-001/SC-003). As transições direcionais são **slides de viewport inteiro** (push estilo mobile): cada lado translada `100%` no eixo (vertical para irmãos de topo, horizontal para profundidade), entrando e saindo borda a borda **sem fade** — uma "rolagem" entre páginas. Apenas `transform` (FR-013, Princípio VIII/IX). O crossfade neutro (`vt-crossfade`, só `opacity`) fica reservado ao `default` (back/forward e reveal de skeleton da US2). `::view-transition-group(*) { overflow: clip }` contém o slide na área de conteúdo para não vazar sobre a sidebar.

**Rationale**: a primeira iteração usava translate de 48px + fade, que num slide de página inteira lê como **crossfade** (a opacidade domina o deslocamento pequeno) — não era o efeito desejado. O usuário pediu explicitamente um scroll vertical/horizontal estilo dispositivo móvel; translate de 100% sem opacidade entrega exatamente isso. Sem `--vt-slide-offset` (o offset agora é sempre 100%). Duração subiu para 350ms para um slide completo mais natural.

---

## Resumo de impacto

- **Zero novas dependências** (React/Next/shadcn já presentes; `Dialog` a confirmar).
- **Zero mudança de dados/DB/API/serviço** — feature puramente de apresentação.
- **Flag experimental** (`experimental.viewTransition`) + `<ViewTransition>` experimental do React: risco de breaking change entre versões; mitigado por smoke test no build de produção (SC-008) e por degradação graciosa.
- **2 spikes isolados**: D3 (direção em back/forward) e D6 (coexistência @dnd-kit × morph). Ambos com fallback que não regride função.

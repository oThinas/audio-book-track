# Feature Specification: Animações de transição entre páginas (View Transitions)

**Feature Branch**: `038-page-view-transitions`

**Created**: 2026-06-23

**Status**: Draft

**Input**: User description: "Animações de transição entre páginas (Fase B — `viewTransition` experimental). Animar a troca de conteúdo ao navegar entre rotas autenticadas sem piscar a sidebar, com crossfade/slide direcional (avançar/voltar), handoff suave do skeleton para o conteúdo, /settings como modal sobre a URL, degradação graciosa em navegadores sem suporte e sob `prefers-reduced-motion`. Item relacionado destravado: morph suave de reordenação de capítulos."

## Clarifications

### Session 2026-06-23

- Q: A Fase B reúne três peças (transições de página, /settings como modal, morph de reordenação). Quais entram nesta feature? → A: Todas as três, priorizadas P1/P2/P3 para permitir corte de P3 durante a implementação.
- Q: Como o sistema decide se uma navegação anima como "avançar" ou "voltar"? → A: Pela relação entre as rotas (profundidade e ordem do menu), não pelo histórico do navegador.
- Q: Como animar a troca entre seções de topo (mesmo nível: dashboard/livros/narradores/editores/estúdios)? → A: Eixo vertical pela ordem do menu — ir para um item mais abaixo = conteúdo novo entra de baixo (desliza para cima); ir para um item mais acima = conteúdo novo entra de cima (desliza para baixo).
- Q: Qual eixo a navegação de profundidade (lista↔detalhe) deve usar? → A: Eixo horizontal — aprofundar (avançar) = conteúdo entra pela direita; voltar para a lista = entra pela esquerda.
- Q: Com o modal de /settings aberto, o que acontece ao clicar em outro item da barra lateral? → A: Não é possível navegar — o overlay do modal cobre a aplicação inteira (inclusive a barra lateral); o usuário precisa fechar o modal primeiro.
- Q: A direção pela relação de rotas deve valer também no botão voltar/avançar do navegador (popstate)? → A: Best-effort — direcional quando tecnicamente viável; crossfade neutro é fallback aceitável (decidido pós-análise; `transitionTypes` só cobre navegação por link/`router`).

## User Scenarios & Testing *(mandatory)*

A Fase A (animação de linhas de lista entrando/saindo) já foi entregue na feature 037. Esta feature (Fase B) entrega a transição animada **entre rotas** e destrava dois itens que dependiam do mesmo mecanismo de transição visual: o modal de configurações e o morph de reordenação de capítulos. O item "linha em modo de edição" foi explicitamente **descartado** do escopo (a largura da célula não muda ao entrar/sair de edição, então não há ganho perceptível).

### User Story 1 - Transição direcional ao navegar entre páginas (Priority: P1)

Ao navegar entre as rotas autenticadas (dashboard, livros, narradores, editores, estúdios, configurações), o usuário vê o conteúdo da página trocar com uma animação suave e direcional, enquanto a barra lateral permanece estável (sem piscar nem recarregar). O sentido é determinado pela **relação entre as rotas** (não pelo histórico do navegador), em dois eixos: navegar entre seções de topo (mesmo nível) usa o **eixo vertical** seguindo a ordem do menu (ir para um item mais abaixo = conteúdo entra de baixo; mais acima = entra de cima); aprofundar/voltar (lista↔detalhe) usa o **eixo horizontal** (avançar = entra pela direita; voltar = entra pela esquerda). A navegação continua sendo instantânea em termos de URL e conteúdo; apenas a troca visual é animada.

**Why this priority**: É o objetivo central da feature e entrega o ganho percebido de polimento e orientação espacial. Sozinha já constitui um MVP viável — as demais histórias são incrementos sobre este mecanismo.

**Independent Test**: Navegar de uma rota a outra (ex.: dashboard → livros → detalhe de um livro → voltar → narradores) e observar que o conteúdo anima no eixo e sentido corretos para cada par de rotas, a URL e o conteúdo finais estão corretos, e a barra lateral não pisca. Testável de ponta a ponta no navegador.

**Acceptance Scenarios**:

1. **Given** o usuário está no dashboard (item mais acima no menu), **When** clica em "Livros" (item mais abaixo), **Then** o conteúdo da área principal entra de baixo (desliza para cima) e a barra lateral permanece visualmente estável.
2. **Given** o usuário está em "Livros", **When** navega de volta ao dashboard (item mais acima no menu) por um link, **Then** o conteúdo entra de cima (desliza para baixo). Quando a navegação parte do botão voltar/avançar do navegador, o sentido correto é **best-effort** (pode degradar para crossfade neutro, sem erro).
3. **Given** o usuário está na lista de livros, **When** abre o detalhe de um livro (aprofundar), **Then** o conteúdo do detalhe entra pela direita (eixo horizontal, sentido "avançar").
4. **Given** o usuário está no detalhe de um livro, **When** retorna à lista, **Then** o conteúdo da lista entra pela esquerda (eixo horizontal, sentido "voltar").
5. **Given** o usuário navega rapidamente entre várias rotas em sequência, **When** as transições se sobrepõem, **Then** o estado final corresponde à última rota solicitada, sem conteúdo duplicado ou "preso" na tela.
6. **Given** uma transição está em andamento, **When** ela termina, **Then** nenhum estilo residual de animação permanece aplicado ao conteúdo (sem elementos fantasma ou travados).

---

### User Story 2 - Transição suave do esqueleto de carregamento para o conteúdo (Priority: P2)

Ao navegar para uma rota cujos dados ainda estão carregando, o usuário vê o esqueleto de carregamento (skeleton) já existente e, quando o conteúdo real fica pronto, a troca esqueleto → conteúdo acontece como um crossfade suave em vez de um corte abrupto.

**Why this priority**: Reduz a sensação de "salto" durante o carregamento e aproveita os esqueletos (`loading.tsx`) já existentes em todas as rotas. Depende do mecanismo da História 1, por isso vem depois.

**Independent Test**: Navegar para uma rota com carregamento perceptível (ou sob rede lenta simulada) e observar que o esqueleto faz uma transição suave para o conteúdo carregado, sem piscar nem cortar.

**Acceptance Scenarios**:

1. **Given** o usuário navega para uma rota que exibe esqueleto de carregamento, **When** o conteúdo real termina de carregar, **Then** a troca do esqueleto para o conteúdo é uma transição suave (crossfade), não um corte instantâneo.
2. **Given** o conteúdo de uma rota carrega instantaneamente (sem janela de esqueleto perceptível), **When** a navegação ocorre, **Then** não há flicker nem animação dupla — apenas a transição direcional da História 1.

---

### User Story 3 - Degradação graciosa e respeito a "movimento reduzido" (Priority: P2)

Usuários em navegadores sem suporte às transições animadas, ou que ativaram a preferência de "reduzir movimento" no sistema operacional, continuam navegando normalmente: a troca de página é instantânea, sem animação, sem erros e sem qualquer degradação de função.

**Why this priority**: É um requisito não-negociável de acessibilidade e robustez do produto. Acompanha obrigatoriamente o release das demais histórias — uma animação que quebra em navegador sem suporte ou que ignora "movimento reduzido" é uma regressão inaceitável.

**Independent Test**: (a) Com a preferência "reduzir movimento" ativada, navegar entre rotas e confirmar troca instantânea sem animação; (b) em um navegador sem suporte à API de transições, navegar entre rotas e confirmar troca instantânea, sem erros no console e com URL/conteúdo corretos.

**Acceptance Scenarios**:

1. **Given** a preferência "reduzir movimento" está ativa, **When** o usuário navega entre rotas, **Then** o conteúdo troca instantaneamente, sem qualquer animação de transição.
2. **Given** um navegador sem suporte à API de transições de view, **When** o usuário navega entre rotas, **Then** o conteúdo troca instantaneamente, sem erros no console e sem perda de função.
3. **Given** qualquer navegador suportado ou não, **When** o usuário usa apenas o teclado para navegar, **Then** a ordem e o destino do foco após a transição permanecem corretos (sem regressão de acessibilidade).

---

### User Story 4 - Configurações como modal sobre a página atual (Priority: P3)

Ao abrir "Configurações" durante a navegação no app, o usuário vê as configurações em um modal cujo overlay cobre toda a aplicação (inclusive a barra lateral), com a URL refletindo `/settings` (estado compartilhável/deep-linkable). Enquanto o modal está aberto, a barra lateral não fica acessível para navegação — o usuário precisa fechar o modal para ir a outra rota. Fechar o modal retorna à página de origem. Acessar `/settings` diretamente (deep-link ou recarregar a página) exibe as configurações como página independente.

**Why this priority**: Melhora o fluxo de configurações sem tirar o usuário do contexto, mas é um incremento sobre o mecanismo central e não bloqueia o valor principal da feature.

**Independent Test**: Navegar dentro do app e abrir "Configurações"; confirmar que abre como modal com overlay cobrindo a aplicação e URL `/settings`, e que fechar retorna à página anterior. Em seguida, recarregar a página em `/settings` e confirmar que renderiza a página independente.

**Acceptance Scenarios**:

1. **Given** o usuário está em qualquer página autenticada, **When** abre "Configurações", **Then** as configurações aparecem em um modal cujo overlay cobre a aplicação inteira (inclusive a barra lateral) e a URL passa a ser `/settings`.
2. **Given** o modal de configurações está aberto, **When** o usuário o fecha (botão de fechar, tecla Esc ou clique no overlay), **Then** o modal some e o usuário retorna à página de origem com a URL anterior restaurada.
3. **Given** o modal de configurações está aberto, **When** o usuário quer ir a outra seção, **Then** precisa primeiro fechar o modal, pois a barra lateral está coberta pelo overlay e não é clicável enquanto o modal está aberto.
4. **Given** o usuário acessa `/settings` diretamente pela barra de endereço ou recarrega a página com essa URL, **When** a página carrega, **Then** as configurações são exibidas como página independente (sem depender de uma página de fundo).

---

### User Story 5 - Morph suave ao reordenar capítulos (Priority: P3)

Ao reordenar capítulos na página de detalhe de um livro (arrastando ou usando os botões de mover para cima/baixo), as linhas que mudam de posição deslizam suavemente para o novo lugar em vez de "pular" instantaneamente.

**Why this priority**: Item que estava deliberadamente parado aguardando o mecanismo de transição desta fase. É um polimento sobre uma funcionalidade já existente (a reordenação já funciona); a animação é o incremento.

**Independent Test**: Em um livro com vários capítulos, reordenar dois capítulos (via arrastar e via botões) e observar que as linhas afetadas animam o reposicionamento suavemente, com a ordem final correta e persistida.

**Acceptance Scenarios**:

1. **Given** um livro com vários capítulos, **When** o usuário move um capítulo de posição via botões mover para cima/baixo, **Then** as linhas afetadas deslizam suavemente para as novas posições.
2. **Given** a preferência "reduzir movimento" está ativa, **When** o usuário reordena capítulos, **Then** as linhas reposicionam instantaneamente, sem animação.
3. **Given** uma reordenação animada acabou de ocorrer, **When** a animação termina, **Then** a nova ordem está corretamente persistida e refletida na tela.

---

### Edge Cases

- **Navegação interrompida**: o usuário dispara uma nova navegação enquanto uma transição ainda está em andamento — o sistema converge para o último destino sem deixar conteúdo intermediário preso.
- **Navegação muito rápida (spam de cliques)**: cliques repetidos em links não acumulam animações nem deixam a interface em estado inconsistente.
- **Carregamento mais lento que a animação**: quando o esqueleto de carregamento permanece além da duração da animação, não há flicker ao finalmente trocar para o conteúdo.
- **Recarregar (refresh) em uma rota de modal** (`/settings`): a página renderiza de forma independente e funcional, sem depender de uma página de fundo previamente carregada.
- **Modo escuro**: todas as transições e o modal funcionam de forma idêntica em tema claro e escuro.
- **Foco e leitores de tela**: a transição não rouba nem perde o foco do teclado, e o conteúdo recém-revelado é anunciado corretamente.
- **Conteúdo de altura/largura muito diferente entre rotas**: a transição não causa saltos abruptos de layout (CLS) perceptíveis ao usuário.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST animar a troca do conteúdo da área principal ao navegar entre rotas autenticadas, mantendo a barra lateral visualmente estável (sem piscar nem recarregar).
- **FR-002**: A animação de transição MUST ser direcional em dois eixos definidos pela relação entre as rotas: (a) navegação entre seções de topo (mesmo nível) usa o eixo **vertical** seguindo a ordem do menu da barra lateral — destino mais abaixo no menu = conteúdo entra de baixo (desliza para cima); destino mais acima = conteúdo entra de cima (desliza para baixo); (b) navegação de profundidade (lista → detalhe = "avançar"; detalhe → lista = "voltar") usa o eixo **horizontal** — avançar = conteúdo entra pela direita; voltar = entra pela esquerda.
- **FR-003**: O sistema MUST preservar a corretude funcional da navegação (URL final, conteúdo final, histórico do navegador) independentemente de haver ou não animação.
- **FR-004**: Ao final de qualquer transição, o sistema MUST não deixar estilos ou elementos residuais de animação aplicados ao conteúdo.
- **FR-005**: O sistema MUST realizar uma transição suave (crossfade) do esqueleto de carregamento para o conteúdo real quando houver janela de carregamento perceptível.
- **FR-006**: O sistema MUST trocar instantaneamente (sem animação) quando a preferência do usuário for "reduzir movimento".
- **FR-007**: O sistema MUST trocar instantaneamente (sem animação) e sem erros em navegadores que não suportam a animação de transição, preservando toda a função de navegação.
- **FR-008**: O sistema MUST preservar a ordem e o destino do foco do teclado após cada transição (sem regressão de acessibilidade).
- **FR-009**: O sistema MUST exibir "Configurações" como um modal cujo overlay cobre toda a aplicação (inclusive a barra lateral) quando aberto durante a navegação no app, refletindo `/settings` na URL.
- **FR-010**: O sistema MUST permitir fechar o modal de configurações (botão de fechar, tecla Esc e clique no overlay), retornando o usuário à página de origem com a URL anterior restaurada.
- **FR-011**: O sistema MUST exibir `/settings` como página independente quando acessado por deep-link direto ou recarregamento da página.
- **FR-012**: O sistema MUST animar (morph/deslize) o reposicionamento das linhas de capítulo ao reordenar, tanto via arrastar quanto via botões de mover para cima/baixo, respeitando "reduzir movimento".
- **FR-013**: As animações de transição e morph MUST usar apenas propriedades amigáveis ao compositor (movimento e opacidade), sem causar saltos de layout perceptíveis.
- **FR-014**: Todas as transições e o modal MUST funcionar de forma idêntica em tema claro e escuro.
- **FR-015**: O sistema MUST convergir para o último destino solicitado quando múltiplas navegações ocorrerem em sucessão rápida, sem deixar conteúdo intermediário preso ou duplicado.
- **FR-016**: Enquanto o modal de configurações estiver aberto, o sistema MUST NOT permitir navegação pela barra lateral (coberta pelo overlay); a navegação para outra rota exige fechar o modal primeiro.
- **FR-017**: O sentido de cada transição MUST ser derivado da relação entre as rotas de origem e destino (profundidade e ordem do menu), nunca do sentido do histórico do navegador (avançar/voltar do navegador não determina, por si só, o sentido da animação). Para navegações disparadas pelo botão **voltar/avançar do navegador** (popstate), aplicar o sentido correto é **best-effort**: quando não for tecnicamente viável, o sistema MAY usar o crossfade neutro como fallback, sem regressão funcional.

### Non-Functional / Quality Requirements

- **NFR-001**: A duração de cada animação de transição MUST ser curta o suficiente para não atrasar a percepção de navegação (alvo: ≤ 400 ms).
- **NFR-002**: A feature MUST NOT introduzir regressão visual perceptível nos breakpoints de referência (320, 768, 1024, 1440) em tema claro e escuro, exceto pela própria animação.
- **NFR-003**: A feature MUST NOT degradar as métricas de carregamento percebido (especialmente estabilidade visual / ausência de saltos de layout).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das rotas autenticadas (dashboard, livros, detalhe de livro, narradores, editores, estúdios, configurações) navegam com transição animada quando suportada, sem erros de console.
- **SC-002**: Em 100% das navegações com "reduzir movimento" ativo ou navegador sem suporte, a troca é instantânea e sem erros, preservando URL e conteúdo corretos.
- **SC-003**: A animação de transição completa em ≤ 400 ms em condições normais.
- **SC-004**: Zero regressão de acessibilidade de teclado: em 100% das transições, o foco permanece correto e a navegação por teclado continua funcional.
- **SC-005**: O modal de configurações abre com overlay cobrindo a aplicação (inclusive a barra lateral) refletindo `/settings` na URL e, ao fechar, restaura a página e a URL anteriores em 100% dos casos; deep-link/refresh em `/settings` renderiza a página independente.
- **SC-006**: A reordenação de capítulos anima o reposicionamento das linhas afetadas (quando o movimento não está reduzido) e a nova ordem é persistida corretamente em 100% das reordenações.
- **SC-007**: Regressão visual nos breakpoints 320/768/1024/1440 em tema claro e escuro permanece sem diferenças além das animações esperadas.
- **SC-008**: A compilação de produção conclui sem erros com a feature ativada.
- **SC-009**: Em 100% das navegações **disparadas por link/`router`** entre seções de topo, o eixo é vertical e o sentido corresponde à ordem do menu; em 100% das navegações de profundidade (lista↔detalhe) por link, o eixo é horizontal e o sentido corresponde a avançar/voltar. Para navegações pelo botão voltar/avançar do navegador (popstate), o sentido direcional é best-effort (crossfade neutro é fallback aceitável).

## Assumptions

- **Escopo da Fase B**: a feature abrange as três peças derivadas da seção Fase B do documento de futuras features — transição direcional entre páginas (núcleo), configurações como modal e morph de reordenação de capítulos — priorizadas (P1/P2/P3) para permitir entrega incremental. O item "linha em modo de edição" foi explicitamente descartado e está fora de escopo.
- **Esqueletos existentes**: todas as rotas já possuem esqueleto de carregamento (entregue na feature 031); esta feature apenas adiciona o handoff suave para o conteúdo, sem criar novos esqueletos.
- **Reordenação existente**: a reordenação de capítulos (arrastar e botões mover para cima/baixo) já é funcional (feature 026); esta feature adiciona apenas a animação de reposicionamento.
- **Modelo de direção (definido nas Clarifications)**: o sentido é derivado da relação entre as rotas (não do histórico do navegador). Seções de topo (mesmo nível) animam no eixo vertical pela ordem do menu; navegação de profundidade (lista↔detalhe) anima no eixo horizontal (avançar = direita, voltar = esquerda). A ordem canônica do menu da barra lateral passa a fazer parte do comportamento observável.
- **Duração/curva da animação**: usar valores curtos e suaves (alvo ≤ 400 ms) consistentes com as transições já existentes no produto; o ajuste fino é decisão de implementação.
- **Deep-link em `/settings`**: recarregar ou acessar diretamente `/settings` renderiza a página de configurações de forma independente; o comportamento de modal sobreposto aplica-se apenas à navegação dentro do app (client-side).
- **Suporte de navegador**: navegadores modernos baseados em Chromium e Safari recentes recebem a animação; demais navegadores (incluindo Firefox até confirmação de suporte) recebem a troca instantânea como degradação graciosa.
- **Sem mudanças de dados**: feature puramente de apresentação — não há mudança de modelo de domínio, schema, repositório ou serviço; nenhuma entidade nova é introduzida.
- **Compatibilidade com o compilador do projeto**: a feature deve coexistir com o compilador React já habilitado no projeto, validada por smoke test na compilação de produção.

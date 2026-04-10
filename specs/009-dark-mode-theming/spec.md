# Feature Specification: Refatoracao de Dark Mode e Primary Color

**Feature Branch**: `009-dark-mode-theming`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Refatorar as paginas da aplicacao para suportar dark mode e primary-color corretamente; garantir que paginas existentes e novas sigam a constituicao. Permitir que o componente de seletor de cores na tela de configuracoes funcione."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dark mode consistente em todas as paginas (Priority: P1)

Como usuario, ao ativar o modo escuro nas configuracoes, todas as paginas da aplicacao (login, dashboard, settings, sidebar e layouts) devem refletir imediatamente um tema escuro com contraste e legibilidade adequados. Nenhum elemento deve permanecer estilizado apenas para modo claro.

**Why this priority**: Dark mode e a entrega principal desta feature. Se paginas mantiverem cores hardcoded para modo claro (fundos brancos, textos escuros fixos), o toggle de tema esta quebrado e a experiencia e inconsistente. E tambem um requisito constitucional do projeto (Principio VII e IX).

**Independent Test**: Pode ser testado alternando o seletor de tema entre Claro, Escuro e Sistema e verificando que todas as superficies visiveis se adaptam. Entrega uma experiencia completa de dark mode.

**Acceptance Scenarios**:

1. **Given** o usuario esta na pagina de login com dark mode ativo, **When** a pagina carrega, **Then** tanto o painel de branding quanto o painel do formulario usam cores compativeis com dark mode (sem resquicios de `bg-white`, `bg-slate-50` ou `text-slate-700`).
2. **Given** o usuario esta autenticado com dark mode ativo, **When** navega para qualquer pagina autenticada (dashboard, settings), **Then** a area de conteudo principal, sidebar e toda tipografia usam tokens de cor semanticos que se adaptam ao tema escuro.
3. **Given** o usuario tem o tema do sistema definido como escuro, **When** abre a aplicacao, **Then** o tema aplica dark mode automaticamente sem intervencao manual e todas as paginas renderizam corretamente.
4. **Given** qualquer pagina da aplicacao, **When** o resultado renderizado e inspecionado, **Then** nenhuma classe Tailwind hardcoded (`bg-slate-*`, `text-slate-*`, `bg-white`, `text-black`) e usada onde um token semantico (`bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`, etc.) deveria estar.

---

### User Story 2 - Primary color refletida nos elementos interativos (Priority: P1)

Como usuario, ao selecionar uma cor primaria (blue, orange, green, red ou amber) nas configuracoes, todos os elementos interativos da aplicacao devem refletir a cor escolhida: itens de navegacao ativos, seletores marcados, inputs com foco e qualquer elemento de destaque.

**Why this priority**: Igualmente critica porque o componente de seletor de cores nas configuracoes atualmente nao propaga a cor escolhida para a UI. Elementos como o estado ativo da sidebar, o estado checked do seletor de tema e do seletor de tamanho de fonte estao hardcoded em azul, ignorando a escolha do usuario.

**Independent Test**: Pode ser testado selecionando cada uma das cinco cores primarias e verificando que o link ativo da sidebar, o estado checked do seletor de tema e do seletor de tamanho de fonte mudam para a cor selecionada. Entrega uma experiencia funcional de customizacao de cores.

**Acceptance Scenarios**:

1. **Given** o usuario seleciona "orange" como cor primaria nas configuracoes, **When** visualiza a sidebar, **Then** o item de navegacao ativo usa a cor primaria laranja (nao azul hardcoded).
2. **Given** o usuario seleciona "green" como cor primaria, **When** visualiza o seletor de tema ou seletor de tamanho de fonte, **Then** o estado checked/ativo usa a cor primaria verde (nao `bg-blue-600` hardcoded).
3. **Given** o usuario seleciona qualquer cor primaria, **When** navega por todas as paginas, **Then** todo elemento interativo de destaque usa o token semantico `primary`, que resolve para a cor escolhida via o atributo CSS `data-primary-color`.
4. **Given** o icone de headphones (marca) na sidebar e na pagina de login, **When** qualquer cor primaria esta ativa, **Then** o icone usa o token de cor primaria em vez de `text-blue-500` hardcoded.

---

### User Story 3 - Pagina de configuracoes adaptada a ambos os temas (Priority: P2)

Como usuario visualizando a pagina de configuracoes, todas as secoes de preferencia (tema, tamanho de fonte, cor primaria, pagina favorita) devem estar visualmente corretas em ambos os modos claro e escuro, usando cores semanticas que fornecem contraste adequado em cada modo.

**Why this priority**: A pagina de configuracoes e o centro de controle das preferencias de tema. Se ela mesma estiver quebrada em dark mode, o usuario nao consegue usar os controles de cor/tema com confianca. Depende da P1 estar resolvida, mas e uma superficie distinta a ser validada.

**Independent Test**: Pode ser testado abrindo a pagina de configuracoes em modo claro e escuro, verificando que todos os labels, descricoes, separadores, seletores e bordas sao legiveis e visualmente consistentes.

**Acceptance Scenarios**:

1. **Given** a pagina de configuracoes em dark mode, **When** o usuario visualiza os separadores de secao, **Then** eles usam uma cor semantica (ex: `bg-border` ou `bg-muted`) em vez de `bg-slate-100` hardcoded.
2. **Given** a pagina de configuracoes em dark mode, **When** o usuario visualiza labels e descricoes, **Then** eles usam `text-foreground` e `text-muted-foreground` em vez de `text-slate-800` e `text-slate-500` hardcoded.
3. **Given** o seletor de pagina favorita em dark mode, **When** o usuario visualiza o dropdown, **Then** o fundo, borda e texto placeholder usam tokens semanticos em vez de `bg-slate-50`, `border-slate-200` e `text-slate-400` hardcoded.

---

### User Story 4 - Pagina de login suporta dark mode (Priority: P2)

Como usuario que prefere dark mode (via preferencia do sistema ou preferencia salva anteriormente), a pagina de login deve renderizar com cores compativeis com dark mode para que a experiencia seja consistente antes e depois da autenticacao.

**Why this priority**: A pagina de login e a primeira impressao. Um login somente claro seguido de uma area autenticada escura quebra a continuidade visual. Como usuarios nao autenticados podem ter dark mode no SO, esta pagina precisa respeita-lo.

**Independent Test**: Pode ser testado definindo o SO para dark mode e carregando a pagina de login, verificando que fundos, texto, card do formulario e elementos de marca se adaptam.

**Acceptance Scenarios**:

1. **Given** o sistema do usuario esta em dark mode, **When** visita a pagina de login, **Then** o painel de branding usa um fundo semantico escuro (nao `bg-slate-800` hardcoded, que e sempre escuro independente do tema).
2. **Given** a pagina de login em modo claro, **When** o usuario visualiza a area do formulario, **Then** o fundo e card usam tokens semanticos (`bg-background`, `bg-card`) em vez de `bg-slate-50` e `bg-white` hardcoded.
3. **Given** o formulario de login, **When** o usuario visualiza os labels, **Then** eles usam `text-foreground` ou `text-muted-foreground` em vez de `text-slate-700` hardcoded.

---

### Edge Cases

- O que acontece quando o usuario alterna entre modo claro e escuro rapidamente? Todas as transicoes devem ser suaves sem flash de cores incorretas.
- Como a aplicacao se comporta quando o atributo `data-primary-color` esta ausente ou com valor nao suportado? A aplicacao deve fazer fallback gracioso para a cor primaria padrao (blue).
- O que acontece quando `prefers-color-scheme` muda no nivel do SO enquanto o usuario tem tema "sistema" selecionado? A aplicacao deve reagir em tempo real via `next-themes`.
- Como novas paginas criadas no futuro herdam o theming correto? Usando apenas tokens semanticos do Tailwind, qualquer nova pagina se adapta automaticamente sem trabalho extra.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todos os fundos de pagina DEVEM usar tokens de cor semanticos (`bg-background`, `bg-card`, `bg-muted`) em vez de classes Tailwind hardcoded.
- **FR-002**: Todos os elementos de texto DEVEM usar tokens de cor semanticos (`text-foreground`, `text-muted-foreground`, `text-card-foreground`) em vez de classes Tailwind hardcoded.
- **FR-003**: Todos os elementos interativos de destaque (estados ativos, estados checked, focus rings) DEVEM usar o token semantico `primary` para refletir a cor primaria escolhida pelo usuario.
- **FR-004**: O componente sidebar DEVE substituir todas as classes hardcoded `bg-slate-*`, `text-slate-*` e `bg-blue-*` por tokens semanticos de sidebar (`bg-sidebar`, `text-sidebar-foreground`, `bg-sidebar-primary`, `text-sidebar-primary-foreground`).
- **FR-005**: A pagina de login DEVE ser theme-aware, adaptando seu painel de branding, area de formulario e tipografia a ambos os modos claro e escuro usando tokens semanticos.
- **FR-006**: Os estados checked do seletor de tema e seletor de tamanho de fonte DEVEM usar o token `primary` em vez de `bg-blue-600` hardcoded.
- **FR-007**: O seletor de pagina favorita DEVE usar tokens semanticos de borda, fundo e texto em vez de classes `slate` hardcoded.
- **FR-008**: Separadores de secao na pagina de configuracoes DEVEM usar tokens semanticos (ex: `bg-border`) em vez de `bg-slate-100` hardcoded.
- **FR-009**: O icone de headphones (marca) DEVE usar o token de cor `primary` em vez de `text-blue-500` hardcoded.
- **FR-010**: O botao de logout DEVE usar o token semantico `destructive` em vez de `text-red-400` hardcoded.
- **FR-011**: O fundo do layout autenticado DEVE usar `bg-background` em vez de `bg-slate-50` hardcoded.
- **FR-012**: Nenhuma nova classe de cor hardcoded pode ser introduzida; todos os componentes novos DEVEM seguir a convencao de tokens semanticos estabelecida por esta refatoracao.

### Key Entities

- **User Preference**: Entidade existente que armazena `theme` (light/dark/system), `primaryColor` (blue/orange/green/red/amber), `fontSize` e `favoritePage`. Nenhuma alteracao de schema necessaria.
- **CSS Custom Properties**: Tokens de design existentes em `globals.css` que definem valores de cor para modo claro (`:root`), modo escuro (`.dark`) e variantes de cor primaria (`[data-primary-color="*"]`). Nenhum token novo esperado; tokens existentes serao consumidos pelos componentes refatorados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das paginas da aplicacao renderizam corretamente em ambos os temas claro e escuro, sem classes de cor hardcoded restantes em componentes de pagina ou layout.
- **SC-002**: Selecionar qualquer uma das cinco cores primarias nas configuracoes atualiza visualmente todos os elementos interativos/de destaque em toda a aplicacao dentro da mesma sessao.
- **SC-003**: Zero regressoes visuais em modo claro apos a refatoracao (aparencia existente e preservada).
- **SC-004**: Todas as novas paginas criadas apos esta refatoracao suportam dark mode e cor primaria automaticamente ao usar apenas tokens semanticos, sem nenhum trabalho extra de theming.
- **SC-005**: O seletor de cor nas configuracoes produz uma mudanca visivel e imediata na aparencia da aplicacao quando uma cor diferente e escolhida.
- **SC-006**: A pontuacao de acessibilidade do Lighthouse permanece igual ou acima do baseline atual apos a refatoracao (ratios de contraste mantidos em ambos os temas).

## Assumptions

- As CSS custom properties existentes em `globals.css` ja definem valores corretos de claro e escuro para todos os tokens semanticos. Nenhuma definicao de token nova e necessaria.
- O mecanismo de atributo `data-primary-color` e o dark mode baseado em classe do `next-themes` estao funcionando corretamente. Esta feature requer apenas consumir esses tokens nos componentes.
- O componente `PreferenceInitializer` aplica corretamente os atributos `data-primary-color` e font size no carregamento da pagina. Nenhuma alteracao necessaria na logica de inicializacao.
- Os swatches do componente seletor de cor primaria (mostrando as opcoes de cor disponiveis) podem manter classes de cor hardcoded, pois representam amostras fixas de cor, nao UI adaptavel ao tema.
- O escopo da refatoracao esta limitado a substituir cores hardcoded por tokens semanticos. Nenhuma pagina, rota ou feature nova esta sendo adicionada.
- Os tokens de sidebar (`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, etc.) ja estao definidos em `globals.css` para ambos os modos claro e escuro.
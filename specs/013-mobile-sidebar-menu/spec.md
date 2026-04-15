# Feature Specification: Mobile Sidebar Menu

**Feature Branch**: `013-mobile-sidebar-menu`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "quando o usuário estiver no mobile, a sidebar não deve ser exibida. ao invés disso, um header com botão 'Menu', sem background e sem bordas, no canto superior esquerdo deve aparecer. ao clicar nesse botão, a sidebar deve ocupar toda página, exceto pelo header. além do texto 'Menu', deve ter um ícone de '=' enquanto a sidebar está fechada. ao abrir a sidebar, o ícone de '=' deve se transformar em 'x' com uma animação graciosa."

## Clarifications

### Session 2026-04-14

- Q: Como o painel de navegação mobile aparece na tela ao abrir? → A: Desliza da esquerda para a direita (slide-in horizontal).
- Q: O foco do teclado deve ficar preso dentro do painel quando aberto? → A: Sim — focus trap ativo no painel + header enquanto aberto; ao fechar, foco retorna ao botão "Menu".

## User Scenarios & Testing

### User Story 1 - Navegar pelo app no celular (Priority: P1)

Como usuário acessando o AudioBook Track pelo celular, quero que o menu de navegação não ocupe espaço permanente na tela, liberando toda a área visível para o conteúdo da página.

**Why this priority**: No mobile, o espaço de tela é escasso. A sidebar fixa (240px ou 64px) consome uma parcela significativa da viewport, tornando a experiência inutilizável. Esconder a sidebar e exibir um botão compacto é o requisito central desta feature.

**Independent Test**: Pode ser testado acessando qualquer página autenticada em viewport mobile (< 768px) e verificando que a sidebar não aparece e o botão "Menu" está visível no canto superior esquerdo.

**Acceptance Scenarios**:

1. **Given** o usuário está em uma página autenticada em viewport mobile (largura < 768px), **When** a página carrega, **Then** a sidebar lateral não é exibida e um header com botão "Menu" aparece no canto superior esquerdo.
2. **Given** o usuário está em viewport mobile, **When** a página carrega, **Then** o botão "Menu" não possui background nem bordas visíveis, exibindo apenas o texto "Menu" e o ícone de hambúrguer (≡).
3. **Given** o usuário redimensiona a janela de desktop para largura < 768px, **When** a transição de breakpoint ocorre, **Then** a sidebar desaparece e o header mobile aparece automaticamente.
4. **Given** o usuário está em viewport desktop (largura ≥ 768px), **When** a página carrega, **Then** a sidebar lateral continua funcionando normalmente (expandida/colapsada) e o header mobile não é exibido.

---

### User Story 2 - Abrir o menu de navegação no mobile (Priority: P1)

Como usuário no celular, quero tocar no botão "Menu" para ver todas as opções de navegação em tela cheia, podendo acessar qualquer seção do app.

**Why this priority**: Sem esta funcionalidade o usuário não consegue navegar entre as páginas no mobile. É tão crítico quanto esconder a sidebar.

**Independent Test**: Pode ser testado tocando/clicando no botão "Menu" em viewport mobile e verificando que o painel de navegação ocupa toda a tela abaixo do header.

**Acceptance Scenarios**:

1. **Given** o usuário está em viewport mobile com a sidebar fechada, **When** toca no botão "Menu", **Then** o painel de navegação desliza da esquerda para a direita, ocupando toda a viewport abaixo do header.
2. **Given** a sidebar mobile está aberta, **When** o usuário observa o painel, **Then** todos os itens de navegação que existem na sidebar desktop estão presentes (Dashboard, Livros, Estúdios, Editores, Gravadores, Configurações, Sair).
3. **Given** a sidebar mobile está aberta, **When** o usuário toca em um item de navegação, **Then** a sidebar fecha automaticamente e o usuário é direcionado para a página correspondente.
4. **Given** a sidebar mobile está aberta, **When** o conteúdo da página por trás não é visível, **Then** a área de conteúdo é totalmente coberta pelo painel de navegação (exceto o header).
5. **Given** a sidebar mobile está aberta, **When** o usuário navega com Tab/Shift+Tab, **Then** o foco permanece preso dentro do painel e do header (focus trap ativo).

---

### User Story 3 - Animação do ícone hambúrguer para X (Priority: P2)

Como usuário no celular, quero que o ícone do botão de menu tenha uma transição suave de hambúrguer (≡) para X (✕) ao abrir/fechar o menu, proporcionando feedback visual claro e agradável.

**Why this priority**: A animação melhora a experiência percebida e dá feedback visual claro do estado do menu. Embora importante para o polimento, não é bloqueante para a funcionalidade principal.

**Independent Test**: Pode ser testado abrindo e fechando o menu mobile e observando a transição animada do ícone.

**Acceptance Scenarios**:

1. **Given** a sidebar mobile está fechada, **When** o usuário observa o botão "Menu", **Then** o ícone exibido é um hambúrguer (três linhas horizontais).
2. **Given** o usuário toca no botão "Menu", **When** a sidebar começa a abrir, **Then** o ícone de hambúrguer se transforma suavemente em X com uma animação fluida (duração entre 200ms e 400ms).
3. **Given** a sidebar mobile está aberta, **When** o usuário toca no botão para fechar, **Then** o ícone de X se transforma suavemente de volta em hambúrguer com a mesma animação.
4. **Given** o usuário tem preferência de acessibilidade `prefers-reduced-motion` ativada, **When** o menu é aberto/fechado, **Then** a transição do ícone acontece instantaneamente sem animação.

---

### User Story 4 - Fechar o menu mobile (Priority: P2)

Como usuário no celular, quero fechar o menu de navegação facilmente para voltar ao conteúdo que estava visualizando.

**Why this priority**: Complementa a funcionalidade de abertura, garantindo que o usuário possa retornar ao conteúdo de forma intuitiva.

**Independent Test**: Pode ser testado abrindo o menu e verificando que ele pode ser fechado pelo botão no header.

**Acceptance Scenarios**:

1. **Given** a sidebar mobile está aberta, **When** o usuário toca no botão no header (que agora exibe "Menu" com ícone X), **Then** a sidebar desliza para a esquerda, fecha, e o conteúdo da página volta a ser visível.
2. **Given** a sidebar mobile está aberta, **When** o usuário pressiona a tecla Escape no teclado, **Then** a sidebar fecha.
3. **Given** a sidebar mobile acabou de fechar, **When** o foco é gerenciado, **Then** o foco retorna automaticamente ao botão "Menu" no header.

---

### Edge Cases

- O que acontece quando o usuário rotaciona o dispositivo de retrato para paisagem e a largura ultrapassa o breakpoint? A sidebar mobile deve fechar e a sidebar desktop deve aparecer automaticamente.
- O que acontece quando o usuário rotaciona de paisagem (desktop-like) para retrato (mobile) com a sidebar desktop expandida? A sidebar desktop deve ser substituída pelo header mobile com sidebar fechada.
- O que acontece se o usuário navega via URL direta no mobile? O menu deve estar fechado por padrão, com o header mobile visível.
- O que acontece com a sidebar desktop collapse/expand state quando o usuário volta para desktop após usar o mobile? O estado salvo no cookie deve ser preservado e restaurado.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE esconder a sidebar lateral em viewports com largura inferior a 768px.
- **FR-002**: O sistema DEVE exibir um header fixo no topo da tela em viewports mobile, contendo um botão "Menu" posicionado no canto superior esquerdo.
- **FR-003**: O botão "Menu" DEVE ser renderizado sem background e sem bordas (estilo ghost/transparent), exibindo o texto "Menu" acompanhado de um ícone de hambúrguer (≡).
- **FR-004**: Ao tocar no botão "Menu", o sistema DEVE abrir um painel de navegação que desliza da esquerda para a direita, ocupando toda a viewport abaixo do header.
- **FR-005**: O painel de navegação mobile DEVE exibir todos os mesmos itens presentes na sidebar desktop (navegação principal, configurações e logout).
- **FR-006**: O ícone de hambúrguer DEVE se transformar em ícone X com uma animação suave (200–400ms) ao abrir o menu, e o inverso ao fechar.
- **FR-007**: A animação do ícone DEVE respeitar a preferência `prefers-reduced-motion` do sistema operacional, desativando a animação quando ativada.
- **FR-008**: Ao tocar em um item de navegação no menu mobile, o sistema DEVE fechar o painel e navegar para a página correspondente.
- **FR-009**: O menu mobile DEVE poder ser fechado tocando no botão do header ou pressionando a tecla Escape.
- **FR-010**: Em viewports com largura ≥ 768px, o sistema DEVE continuar exibindo a sidebar desktop com o comportamento atual (expandir/colapsar).
- **FR-011**: A transição entre layout mobile e desktop DEVE acontecer automaticamente ao redimensionar a janela ou rotacionar o dispositivo, sem recarregar a página.
- **FR-012**: O header mobile DEVE funcionar corretamente em modo claro e escuro.
- **FR-013**: Quando o painel de navegação mobile está aberto, o foco do teclado DEVE ser preso dentro do painel e do header (focus trap). Navegação por Tab/Shift+Tab não pode alcançar elementos fora do overlay.
- **FR-014**: Ao fechar o painel de navegação mobile, o foco DEVE retornar automaticamente ao botão "Menu" no header.
- **FR-015**: A animação de abertura/fechamento do painel DEVE respeitar a preferência `prefers-reduced-motion`, desativando o slide quando ativada.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Usuários em tela mobile (< 768px) conseguem acessar todas as seções de navegação em até 2 toques (1 para abrir menu, 1 para selecionar destino).
- **SC-002**: A animação do ícone hambúrguer ↔ X é percebida como fluida, sem travamentos ou saltos visuais, em dispositivos com performance moderada.
- **SC-003**: Nenhum conteúdo da página principal é visível quando o painel de navegação mobile está aberto.
- **SC-004**: A transição entre breakpoints mobile/desktop acontece sem flicker visual ou estado intermediário quebrado.
- **SC-005**: Toda a funcionalidade de navegação existente no desktop permanece inalterada após a implementação.

## Assumptions

- O breakpoint de 768px é adequado para separar experiência mobile de desktop, alinhado com padrões comuns de tablets em modo retrato.
- A sidebar mobile será implementada como overlay sobre o conteúdo (não como push do conteúdo para o lado), conforme descrito pelo usuário — "ocupar toda a página exceto pelo header".
- O estado de aberto/fechado do menu mobile não precisa ser persistido entre sessões (ao recarregar, o menu inicia fechado).
- O header mobile terá altura suficiente para acomodar o botão "Menu" com conforto para toque (mínimo 44px de área tocável, conforme diretrizes de acessibilidade).
- Animação CSS pura (transitions/keyframes) é suficiente para a transformação do ícone hambúrguer → X e para o slide horizontal do painel, sem necessidade de biblioteca de animação externa — caso testes revelem limitações, biblioteca será avaliada na fase de planejamento.
- O item de navegação ativo (página atual) continua destacado visualmente no menu mobile, seguindo o mesmo padrão da sidebar desktop.
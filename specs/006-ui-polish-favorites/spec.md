# Feature Specification: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Feature Branch**: `006-ui-polish-favorites`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "1. estilizar página de login de acordo com design; 2. adicionar comportamento de expandir e minimizar na sidebar; 3. estilizar a página de configurações; 4. remover a página '/' — redirecionar para página favorita do usuário; 5. adicionar funcionalidade de escolher página favorita, tema, tamanho da fonte e cor primária nas configurações."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Estilização da Página de Login (Priority: P1)

O usuário acessa a página de login e vê uma interface visual refinada conforme o design definido no arquivo `design.pen` (frame "01 - Login"). A tela é dividida em dois painéis: à esquerda, o branding com fundo escuro (sidebar-bg), título do sistema e subtítulo centralizados; à direita, o formulário de login com card elevado (sombra sutil) centralizado contendo campos de email e senha, botão de entrar e links auxiliares, sobre fundo claro (bg-page). Em telas menores, o painel de branding é ocultado e o formulário ocupa toda a largura.

**Why this priority**: A página de login é a primeira impressão do usuário no sistema. Uma interface profissional e alinhada ao design transmite confiança e qualidade.

**Independent Test**: Pode ser testada abrindo `/login` no browser e comparando visualmente com o design de referência em mobile, tablet e desktop.

**Acceptance Scenarios**:

1. **Given** um usuário não autenticado em desktop, **When** acessa `/login`, **Then** vê a tela dividida com painel de branding à esquerda e formulário à direita, conforme o design.
2. **Given** um usuário não autenticado em mobile (< 640px), **When** acessa `/login`, **Then** vê apenas o formulário centralizado, sem o painel de branding.
3. **Given** a página de login renderizada, **When** o usuário observa os elementos visuais, **Then** as cores, tipografia, espaçamentos e sombras correspondem aos design tokens definidos (color/sidebar-bg, color/bg-surface, color/bg-page, color/text-primary, color/text-muted).
4. **Given** um login bem-sucedido, **When** a autenticação é confirmada, **Then** o usuário é redirecionado para sua página favorita (ou /dashboard como padrão).

---

### User Story 2 — Sidebar Expansível e Colapsável (Priority: P2)

O usuário pode expandir e minimizar a sidebar de navegação. No estado expandido, a sidebar mostra ícones e rótulos de texto dos itens de navegação. No estado colapsado (64px de largura, conforme frame "[Componente] Sidebar — Estado Colapsado" no design), mostra apenas os ícones centralizados. O estado da sidebar é preservado entre navegações na mesma sessão.

**Why this priority**: A sidebar colapsável melhora o aproveitamento de espaço, especialmente em telas menores, e dá ao usuário controle sobre sua área de trabalho.

**Independent Test**: Pode ser testada clicando no botão de toggle da sidebar e verificando que alterna entre expandido e colapsado, preservando o estado entre páginas.

**Acceptance Scenarios**:

1. **Given** a sidebar expandida, **When** o usuário clica no botão de minimizar, **Then** a sidebar colapsa para 64px mostrando apenas ícones centralizados.
2. **Given** a sidebar colapsada, **When** o usuário clica no botão de expandir, **Then** a sidebar expande mostrando ícones e rótulos de texto.
3. **Given** a sidebar colapsada, **When** o usuário navega para outra página, **Then** a sidebar permanece colapsada.
4. **Given** a sidebar em qualquer estado, **When** a transição ocorre, **Then** há uma animação suave entre os estados.
5. **Given** a tela em modo mobile (< 640px), **When** o usuário interage com a sidebar, **Then** a sidebar se comporta como overlay ou drawer, não empurrando o conteúdo.

---

### User Story 3 — Estilização da Página de Configurações (Priority: P2)

O usuário acessa a página de configurações e vê a interface conforme o design (frame "05 - Configurações"). A tela exibe um título "Configurações" e cards organizados com os formulários de preferências do usuário (página favorita, tema, tamanho da fonte, cor primária), mantendo consistência visual com as demais páginas.

**Why this priority**: A página de configurações é o hub de personalização do usuário e precisa estar visualmente consistente antes de receber as funcionalidades de preferências.

**Independent Test**: Pode ser testada acessando a página de configurações e comparando com o design de referência.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** acessa a página de configurações, **Then** vê o título "Configurações" e cards com formulários de preferências conforme o design.
2. **Given** a página de configurações renderizada, **When** o usuário observa, **Then** os espaçamentos, bordas, cores e tipografia estão consistentes com as demais páginas.
3. **Given** a página em mobile, **When** o usuário acessa, **Then** os cards se empilham verticalmente ocupando a largura total.

---

### User Story 4 — Preferências de Personalização: Tema, Fonte e Cor (Priority: P3)

Na página de configurações, o usuário pode personalizar sua experiência visual escolhendo:
- **Tema**: Claro, Escuro ou Sistema (padrão: Sistema — segue a preferência do SO).
- **Tamanho da fonte**: Pequena, Média (padrão) ou Grande.
- **Cor primária**: Azul (#2563EB — padrão), Laranja (#F97316), Verde (#10B981), Vermelho (#EF4444) ou Âmbar (#D97706), conforme os tokens do design.

Todas as preferências são persistidas no servidor e aplicadas independentemente do dispositivo em que o usuário estiver logado.

**Why this priority**: A personalização visual é uma funcionalidade de conforto que melhora a experiência do usuário, mas depende da página de configurações estilizada (Story 3).

**Independent Test**: Pode ser testada alterando cada preferência e verificando que a mudança é aplicada imediatamente na interface e persiste após logout/login em outro dispositivo.

**Acceptance Scenarios**:

1. **Given** um usuário na página de configurações, **When** visualiza a seção de aparência, **Then** vê opções para tema (Claro, Escuro, Sistema), tamanho da fonte (Pequena, Média, Grande) e cor primária (5 opções visuais).
2. **Given** o usuário seleciona "Escuro" como tema, **When** a preferência é salva, **Then** a interface muda imediatamente para o tema escuro e feedback visual confirma a alteração.
3. **Given** o usuário seleciona "Grande" como tamanho de fonte, **When** a preferência é salva, **Then** todos os textos da interface aumentam proporcionalmente.
4. **Given** o usuário seleciona "Verde" como cor primária, **When** a preferência é salva, **Then** botões, links ativos e elementos de destaque mudam para a paleta verde.
5. **Given** o usuário salva preferências no desktop, **When** faz login em outro dispositivo, **Then** as mesmas preferências são aplicadas automaticamente.
6. **Given** um novo usuário sem preferências salvas, **When** acessa o sistema, **Then** o tema "Sistema", fonte "Média" e cor "Azul" são aplicados como padrão.
7. **Given** o usuário altera qualquer preferência, **When** a alteração é feita, **Then** a preferência é salva automaticamente no servidor (sem botão "Salvar") e feedback visual inline confirma o salvamento.

---

### User Story 5 — Redirecionamento da Página Inicial e Página Favorita (Priority: P3)

Quando o usuário autenticado acessa a URL raiz (`/`), o sistema redireciona automaticamente para a página favorita do usuário. Se não houver página favorita configurada, redireciona para `/dashboard` (padrão). Se o usuário não estiver autenticado, redireciona para `/login`. A mesma lógica se aplica após o login bem-sucedido: o destino é a página favorita (ou dashboard).

Na página de configurações, o usuário pode selecionar qual página do sistema será sua "página favorita". As opções incluem todas as páginas navegáveis: Dashboard, Livros, Estúdios, Editores, Gravadores e Configurações.

**Why this priority**: Depende da Story 3 (configurações estilizadas) e Story 4 (preferências persistidas). Elimina uma página sem conteúdo útil e personaliza a experiência de navegação.

**Independent Test**: Pode ser testada alterando a página favorita nas configurações e verificando que o redirecionamento de `/` e o destino pós-login mudam de acordo.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado sem página favorita configurada, **When** acessa `/`, **Then** é redirecionado para `/dashboard`.
2. **Given** um usuário autenticado com página favorita "Livros", **When** acessa `/`, **Then** é redirecionado para a página de livros.
3. **Given** um usuário não autenticado, **When** acessa `/`, **Then** é redirecionado para `/login`.
4. **Given** um usuário que acabou de fazer login com página favorita "Estúdios", **When** o login é bem-sucedido, **Then** é redirecionado para a página de estúdios.
5. **Given** um usuário na página de configurações, **When** seleciona "Livros" como página favorita e salva, **Then** o sistema confirma com feedback visual.
6. **Given** um novo usuário sem preferência, **When** visualiza o campo de página favorita nas configurações, **Then** "Dashboard" aparece como valor padrão.
7. **Given** um usuário com página favorita configurada para uma rota removida ou inacessível, **When** acessa `/`, **Then** é redirecionado para `/dashboard` como fallback.

---

### Edge Cases

- O que acontece quando a página favorita configurada não existe mais no sistema? O sistema redireciona para `/dashboard` como fallback.
- O que acontece quando o usuário redimensiona a janela com a sidebar em transição? A animação deve completar sem glitches visuais.
- O que acontece quando o usuário salva a mesma preferência que já está configurada? O sistema aceita silenciosamente sem erro.
- O que acontece quando a sessão expira enquanto o usuário está na página de configurações? O sistema redireciona para `/login` ao tentar salvar.
- O que acontece quando o tema é "Sistema" e o usuário alterna a preferência do SO entre claro e escuro? A interface deve acompanhar a mudança em tempo real.
- O que acontece quando o usuário escolhe uma cor primária que tem baixo contraste no tema escuro? Os design tokens devem garantir acessibilidade em ambos os temas.

## Clarifications

### Session 2026-04-01

- Q: Mecanismo de salvamento das preferências — auto-save individual ou botão explícito "Salvar"? → A: Auto-save — cada preferência é salva individualmente no momento em que o usuário a altera, com feedback visual inline (checkmark ou toast).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A página de login DEVE exibir layout de dois painéis conforme o design (branding à esquerda, formulário à direita) em desktop, e formulário centralizado em mobile.
- **FR-002**: Após login bem-sucedido, o sistema DEVE redirecionar o usuário para sua página favorita configurada (ou `/dashboard` como padrão).
- **FR-003**: A sidebar DEVE ter um botão de toggle que alterna entre estado expandido (com ícones e rótulos) e colapsado (64px, apenas ícones).
- **FR-004**: A transição da sidebar DEVE ser animada suavemente.
- **FR-005**: O estado da sidebar (expandido/colapsado) DEVE ser preservado entre navegações dentro da mesma sessão.
- **FR-006**: A página de configurações DEVE exibir título e cards com formulários de preferências estilizados conforme o design.
- **FR-007**: A página de configurações DEVE incluir seleção para: página favorita, tema, tamanho da fonte e cor primária.
- **FR-008**: As opções de tema DEVEM ser: Claro, Escuro e Sistema (padrão).
- **FR-009**: As opções de tamanho de fonte DEVEM ser: Pequena, Média (padrão) e Grande.
- **FR-010**: As opções de cor primária DEVEM ser: Azul (#2563EB — padrão), Laranja (#F97316), Verde (#10B981), Vermelho (#EF4444) e Âmbar (#D97706).
- **FR-011**: As opções de página favorita DEVEM incluir: Dashboard, Livros, Estúdios, Editores, Gravadores e Configurações.
- **FR-012**: Todas as preferências do usuário DEVEM ser persistidas no servidor via auto-save individual (cada preferência é salva no momento da alteração, sem botão "Salvar" explícito) e aplicadas em qualquer dispositivo onde o usuário fizer login. Feedback visual inline (checkmark ou toast) DEVE confirmar cada salvamento.
- **FR-013**: Ao acessar `/`, o sistema DEVE redirecionar para a página favorita do usuário (ou `/dashboard` como padrão).
- **FR-014**: A página `/` NÃO DEVE exibir conteúdo próprio — deve apenas redirecionar.
- **FR-015**: Todas as páginas estilizadas DEVEM utilizar design tokens (cores, tipografia, espaçamentos), sem valores hardcoded.
- **FR-016**: Quando a página favorita configurada não existir ou estiver inacessível, o sistema DEVE redirecionar para `/dashboard` como fallback.
- **FR-017**: A mudança de tema DEVE respeitar a opção "Sistema", reagindo em tempo real a mudanças na preferência do SO.
- **FR-018**: Todas as telas DEVEM seguir abordagem mobile first, com layout adaptativo para mobile, tablet e desktop.

### Key Entities

- **Preferência do Usuário**: Armazena configurações pessoais do usuário. Pertence a um usuário (1:1). Atributos-chave: página favorita (rota válida do sistema), tema (claro/escuro/sistema), tamanho da fonte (pequena/média/grande), cor primária (identificador de paleta).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das páginas estilizadas (login, configurações) estão visualmente alinhadas com o design de referência em mobile, tablet e desktop, validado por comparação visual.
- **SC-002**: O toggle da sidebar alterna entre expandido e colapsado em menos de 300ms, com animação perceptível e sem quebras visuais.
- **SC-003**: 100% dos acessos a `/` resultam em redirecionamento correto (página favorita ou dashboard) em menos de 1 segundo.
- **SC-004**: Após login bem-sucedido, 100% dos redirecionamentos levam à página favorita do usuário (ou dashboard como padrão).
- **SC-005**: O usuário consegue alterar qualquer preferência (tema, fonte, cor, favorita) em no máximo 3 cliques a partir de qualquer página do sistema.
- **SC-006**: Preferências salvas em um dispositivo são aplicadas em 100% dos logins subsequentes em qualquer dispositivo.
- **SC-007**: Nenhum valor visual hardcoded (cor, espaçamento, tipografia) está presente nas páginas estilizadas — todos derivados de design tokens.
- **SC-008**: Todas as telas passam em validação visual nos 3 breakpoints obrigatórios: mobile (< 640px), tablet (640–1024px) e desktop (> 1024px).

## Assumptions

- O sistema de autenticação existente (better-auth) será reutilizado sem modificações.
- O design de referência no arquivo `design.pen` é a fonte de verdade para estilos visuais.
- Os design tokens (cores, tipografia) já estão definidos como variáveis no sistema de design e serão mapeados para o tema da aplicação.
- A persistência das preferências do usuário utilizará a infraestrutura de banco de dados existente (PostgreSQL via Drizzle ORM).
- O estado expandido/colapsado da sidebar é armazenado no lado do cliente (sessão do navegador), não no banco de dados — por ser preferência de sessão, não de perfil.
- As páginas navegáveis do sistema para seleção de favorita são: Dashboard, Livros, Estúdios, Editores, Gravadores e Configurações.
- O tema "Sistema" utiliza `prefers-color-scheme` do navegador para detectar a preferência do SO.
- As 5 opções de cor primária correspondem exatamente aos tokens de cor definidos na biblioteca de componentes do design (primary, accent, success, danger, warning).
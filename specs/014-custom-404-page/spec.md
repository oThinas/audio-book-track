# Feature Specification: Pagina 404 Personalizada

**Feature Branch**: `014-custom-404-page`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "Adicionar pagina 404 com alguma piadinha envolvendo narracao de livros. Algo como 'Esse capitulo ainda nao foi escrito...'"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pagina 404 com humor tematico (Priority: P1)

Um usuario autenticado ou nao-autenticado tenta acessar uma URL que nao existe no sistema (ex: `/abc`, `/books/999999/xyz`). Em vez de ver uma pagina branca ou generica do framework, o usuario ve uma pagina 404 personalizada com uma piadinha tematica de narracao/audiobooks que transmite a personalidade do produto e orienta o usuario de volta a uma pagina valida.

**Why this priority**: E o unico cenario da feature — sem ele nao ha valor entregue. Toda visita a uma rota inexistente resulta numa experiencia quebrada se nao houver pagina 404 personalizada.

**Independent Test**: Pode ser testado acessando qualquer rota invalida no browser e verificando que a pagina 404 customizada aparece com a mensagem humoristica e o botao de navegacao.

**Acceptance Scenarios**:

1. **Given** o usuario esta em qualquer parte do sistema, **When** ele acessa uma URL inexistente, **Then** o sistema exibe a pagina 404 personalizada com a mensagem tematica e um botao para voltar a pagina inicial.
2. **Given** a pagina 404 esta visivel, **When** o usuario clica no botao de navegacao, **Then** ele e redirecionado para a pagina inicial do sistema.
3. **Given** o usuario esta em modo escuro ou claro, **When** a pagina 404 e exibida, **Then** ela se adapta corretamente ao tema ativo.

---

### User Story 2 - Mensagem variada a cada visita (Priority: P2)

Ao acessar a pagina 404, o usuario ve uma mensagem humoristica diferente a cada visita (selecionada aleatoriamente de um conjunto de frases tematicas de audiobooks/narracao). Isso torna a experiencia mais divertida caso o usuario encontre o erro mais de uma vez.

**Why this priority**: Complementa a experiencia da P1 com variedade, mas a feature funciona perfeitamente com uma unica mensagem fixa.

**Independent Test**: Pode ser testado recarregando a pagina 404 multiplas vezes e verificando que mensagens diferentes aparecem.

**Acceptance Scenarios**:

1. **Given** a pagina 404 e exibida, **When** o usuario recarrega a pagina, **Then** ha chance de ver uma mensagem diferente da anterior (conjunto minimo de 5 frases).
2. **Given** o conjunto de frases, **When** qualquer frase e exibida, **Then** ela esta no contexto tematico de audiobooks/narracao de livros.

### Edge Cases

- O que acontece quando o usuario acessa uma rota inexistente sem estar autenticado? A pagina 404 deve ser exibida independentemente do estado de autenticacao.
- A pagina 404 deve funcionar corretamente em viewports mobile e desktop.
- A pagina 404 nao deve interferir com redirecionamentos de rotas protegidas (ex: rota autenticada sem sessao deve redirecionar para login, nao mostrar 404).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir uma pagina 404 personalizada quando o usuario acessar uma URL inexistente.
- **FR-002**: A pagina 404 DEVE conter uma mensagem humoristica tematica de audiobooks/narracao de livros.
- **FR-003**: A pagina 404 DEVE exibir um botao que permita o usuario navegar de volta para a pagina inicial.
- **FR-004**: A pagina 404 DEVE funcionar corretamente nos modos claro e escuro.
- **FR-005**: A pagina 404 DEVE ser responsiva, funcionando em viewports mobile e desktop.
- **FR-006**: A pagina 404 DEVE selecionar aleatoriamente uma mensagem de um conjunto minimo de 5 frases tematicas.
- **FR-007**: A pagina 404 NAO deve interferir com o fluxo de redirecionamento de rotas protegidas (autenticacao).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das rotas inexistentes exibem a pagina 404 personalizada em vez de tela branca ou erro generico.
- **SC-002**: A pagina 404 renderiza corretamente em todos os breakpoints (mobile 320px ate desktop 1920px).
- **SC-003**: A pagina 404 funciona corretamente em ambos os temas (claro e escuro).
- **SC-004**: O usuario consegue retornar a pagina inicial em no maximo 1 clique a partir da pagina 404.
- **SC-005**: O conjunto de mensagens tematicas contem no minimo 5 frases variadas.

## Assumptions

- A pagina 404 e uma `not-found.tsx` no nivel raiz do App Router do Next.js, seguindo a convencao do framework.
- A pagina nao requer autenticacao e e acessivel por qualquer visitante.
- O layout da pagina segue os padroes visuais do projeto (design tokens, componentes shadcn/ui).
- As frases humoristicas sao em portugues brasileiro, no contexto de audiobooks e narracao.
- A pagina e estatica (Server Component), sem necessidade de data fetching.

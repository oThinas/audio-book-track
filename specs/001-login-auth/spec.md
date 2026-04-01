# Feature Specification: Login e Autenticação

**Feature Branch**: `001-login-auth`  
**Created**: 2026-03-31  
**Status**: Draft  
**Input**: User description: "Implementar a funcionalidade de login com Next.js, TypeScript, Tailwind, Vitest, Supertest, Faker.js, Biome, shadcn/ui, Lucide, Drizzle ORM, PostgreSQL, Docker, better-auth, Zod e Bun."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fazer login com username e senha (Priority: P1)

Um usuário cujas credenciais foram previamente cadastradas no banco de dados acessa a página de login do AudioBook Track, informa seu username e senha, e é autenticado. Após o login, é redirecionado ao dashboard.

**Why this priority**: O login é a única porta de entrada ao sistema. Sem ele, nenhuma outra funcionalidade é acessível. É o requisito mais fundamental.

**Independent Test**: Pode ser testado inserindo um usuário no banco de dados, acessando a página de login, preenchendo username e senha corretos e verificando o redirecionamento ao dashboard.

**Acceptance Scenarios**:

1. **Given** um usuário com credenciais cadastradas no banco, **When** ele informa username e senha corretos na página de login, **Then** uma sessão é iniciada (duração de 7 dias) e o usuário é redirecionado ao dashboard.
2. **Given** um visitante, **When** ele informa username ou senha incorretos, **Then** o sistema exibe uma mensagem genérica de "credenciais inválidas" sem indicar qual campo está errado.
3. **Given** um visitante, **When** ele submete o formulário de login com campos vazios, **Then** o sistema exibe erros de validação nos campos obrigatórios.
4. **Given** um usuário já autenticado, **When** ele acessa a página de login, **Then** é redirecionado ao dashboard automaticamente.

---

### User Story 2 - Proteção de rotas autenticadas (Priority: P1)

Todas as rotas do sistema (dashboard, livros, capítulos, etc.) são acessíveis apenas para usuários autenticados. Visitantes não autenticados são redirecionados à página de login.

**Why this priority**: Sem proteção de rotas, qualquer pessoa pode acessar dados do sistema. É um requisito de segurança fundamental e tem a mesma prioridade do login, pois ambos são indispensáveis.

**Independent Test**: Pode ser testado tentando acessar uma rota protegida sem estar autenticado e verificando o redirecionamento para a página de login.

**Acceptance Scenarios**:

1. **Given** um visitante não autenticado, **When** ele tenta acessar qualquer rota protegida (ex: `/dashboard`), **Then** é redirecionado à página de login.
2. **Given** um usuário autenticado com sessão válida, **When** ele acessa uma rota protegida, **Then** o conteúdo é exibido normalmente.
3. **Given** um usuário cuja sessão expirou (após 7 dias), **When** ele tenta acessar uma rota protegida, **Then** é redirecionado à página de login.

---

### User Story 3 - Persistência de sessão por 7 dias (Priority: P1)

Um usuário autenticado permanece logado por até 7 dias sem precisar informar credenciais novamente, mesmo ao fechar e reabrir o navegador.

**Why this priority**: Sem persistência de sessão, o usuário precisaria fazer login a cada acesso, tornando o uso do sistema impraticável. É parte essencial da experiência de autenticação.

**Independent Test**: Pode ser testado fazendo login, fechando o navegador, reabrindo e verificando que o acesso ao dashboard continua funcionando sem novo login.

**Acceptance Scenarios**:

1. **Given** um usuário que fez login há menos de 7 dias, **When** ele acessa o sistema novamente (mesmo após fechar o navegador), **Then** continua autenticado sem precisar informar credenciais.
2. **Given** um usuário que fez login há mais de 7 dias, **When** ele acessa o sistema, **Then** é redirecionado à página de login para autenticar novamente.

---

### User Story 4 - Fazer logout (Priority: P2)

Um usuário autenticado pode encerrar sua sessão clicando em um botão de logout, sendo redirecionado à página de login.

**Why this priority**: O logout é importante para segurança, mas menos crítico que os fluxos de entrada. O sistema funciona sem ele (a sessão expira em 7 dias), porém é esperado por qualquer aplicação web.

**Independent Test**: Pode ser testado fazendo login, clicando em logout e verificando que a sessão foi encerrada e o acesso a rotas protegidas requer novo login.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele clica no botão de logout, **Then** a sessão é encerrada e o usuário é redirecionado à página de login.
2. **Given** um usuário que acabou de fazer logout, **When** ele tenta acessar uma rota protegida, **Then** é redirecionado à página de login.

---

### User Story 5 - Ambiente de desenvolvimento com Docker (Priority: P2)

Um desenvolvedor clona o repositório e, com um único comando, sobe todo o ambiente de desenvolvimento incluindo banco de dados, aplicação e migrations.

**Why this priority**: Embora não seja uma funcionalidade visível ao usuário final, é pré-requisito para qualquer desenvolvimento produtivo. É P2 porque pode ser configurado manualmente como alternativa temporária.

**Independent Test**: Pode ser testado clonando o repositório em uma máquina limpa (com Docker instalado), executando o comando de setup e verificando que a aplicação responde corretamente.

**Acceptance Scenarios**:

1. **Given** um desenvolvedor com Docker instalado, **When** ele executa o comando de setup do projeto, **Then** o banco de dados, a aplicação e as migrations são executados automaticamente.
2. **Given** o ambiente Docker em execução, **When** o desenvolvedor acessa a aplicação localmente, **Then** a página de login é exibida corretamente.

---

### Edge Cases

- O que acontece quando o banco de dados está indisponível durante uma tentativa de login? O sistema deve exibir uma mensagem amigável de erro temporário, sem revelar detalhes técnicos.
- O que acontece quando múltiplas tentativas de login falham em sequência? O sistema bloqueia o IP após 3 tentativas em 1 minuto, com desbloqueio automático após 5 minutos.
- O que acontece quando cookies de sessão são inválidos ou corrompidos? O sistema deve encerrar a sessão e redirecionar ao login.
- O que acontece quando o username contém caracteres fora do padrão permitido (alfanumérico + underscore, 3-30 caracteres)? O sistema deve rejeitar com erro de validação antes de tentar autenticação.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE autenticar usuários existentes com username e senha.
- **FR-002**: O sistema NÃO DEVE permitir criação de contas via interface web. Contas são gerenciadas diretamente no banco de dados.
- **FR-003**: O sistema DEVE manter sessões autenticadas por 7 dias usando cookies seguros (httpOnly, secure, sameSite).
- **FR-004**: O sistema DEVE invalidar sessões automaticamente após 7 dias, exigindo novo login. Múltiplas sessões simultâneas são permitidas (cada uma com expiração independente).
- **FR-005**: O sistema DEVE proteger todas as rotas da aplicação (exceto a página de login), redirecionando visitantes não autenticados para a página de login.
- **FR-006**: O sistema DEVE permitir que usuários encerrem sua sessão (logout).
- **FR-007**: O sistema DEVE validar todos os inputs do usuário antes de processar a autenticação: username alfanumérico + underscore (3-30 caracteres), senha não vazia (mínimo 6 caracteres).
- **FR-008**: O sistema DEVE exibir mensagens de erro genéricas em falhas de autenticação como toasters (notificações temporárias), sem revelar se o username existe ou qual campo está incorreto.
- **FR-009**: O sistema DEVE implementar rate limiting nas rotas de autenticação: máximo de 3 tentativas por minuto por IP, com bloqueio de 5 minutos após exceder o limite.
- **FR-010**: O sistema DEVE armazenar senhas de forma segura usando hashing (nunca em texto plano).
- **FR-011**: O sistema DEVE redirecionar usuários já autenticados que acessam a página de login para o dashboard.
- **FR-012**: O sistema DEVE exibir uma sidebar de navegação em todas as telas autenticadas, contendo: link para "Dashboard", nome do usuário logado e botão de logout. Itens de navegação adicionais serão incluídos em features futuras.
- **FR-013**: O dashboard DEVE exibir áreas de placeholder para gráficos e KPIs que serão implementados em features futuras.
- **FR-014**: O sistema DEVE fornecer um ambiente de desenvolvimento containerizado que suba banco de dados e aplicação com um único comando.

### Key Entities

- **User (Usuário)**: Representa uma pessoa com acesso ao sistema. Atributos: identificador único, nome, username (único, alfanumérico + underscore, 3-30 caracteres), senha (armazenada como hash), e-mail, data de criação. Contas são criadas diretamente no banco de dados, sem fluxo de cadastro na interface.
- **Session (Sessão)**: Representa uma sessão de autenticação ativa. Atributos: identificador único, referência ao usuário, token, data de expiração (7 dias após criação). Uma sessão expirada ou invalidada impede acesso a rotas protegidas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuários conseguem fazer login e acessar o dashboard em menos de 10 segundos (do acesso à página de login até a visualização do dashboard).
- **SC-002**: 100% das tentativas de acesso a rotas protegidas por visitantes não autenticados resultam em redirecionamento para a página de login.
- **SC-003**: 100% das senhas são armazenadas com hashing seguro — nenhuma senha em texto plano no banco de dados.
- **SC-004**: Sessões permanecem válidas por exatamente 7 dias, com invalidação automática após expiração.
- **SC-005**: Mensagens de erro de autenticação não revelam informações sobre a existência de contas ou detalhes internos do sistema.
- **SC-006**: O ambiente de desenvolvimento é funcional com um único comando em menos de 3 minutos (incluindo download de imagens Docker na primeira execução).
- **SC-007**: Cobertura de testes >= 80% geral, com 100% de cobertura na lógica de validação de autenticação.

## Clarifications

### Session 2026-03-31

- Q: Formato e restrições do username? → A: Alfanumérico + underscore, 3-30 caracteres.
- Q: Rate limiting — limite de tentativas de login? → A: 3 tentativas por minuto, bloqueio de 5 minutos.
- Q: Conteúdo do dashboard pós-login? → A: Página com placeholders para gráficos/KPIs (implementados no futuro) e sidebar presente em todas as telas autenticadas.
- Q: Itens de navegação da sidebar? → A: Apenas "Dashboard" e logout. Itens adicionais serão incluídos em features futuras.
- Q: Sessões simultâneas permitidas? → A: Sim, múltiplas sessões simultâneas permitidas (cada uma com 7 dias independentes).
- Q: Como exibir erros do backend no frontend? → A: Mensagens de erro do backend são exibidas como toasters (notificações temporárias).
- Q: Biblioteca de formulários? → A: react-hook-form, conforme recomendado pelo shadcn/ui.

## Assumptions

- O sistema terá um único tipo de usuário nesta fase (sem distinção de papéis como admin, editor ou narrador). Papéis serão adicionados em features futuras.
- Recuperação de senha está fora do escopo desta feature e será tratada em uma feature separada, se necessário.
- Contas de usuário são criadas manualmente no banco de dados (via seed, migration ou acesso direto). Não há fluxo de cadastro na interface.
- O sistema será acessado via navegador web em desktop. Responsividade mobile é desejável mas não obrigatória nesta fase.
- O banco de dados PostgreSQL será acessível apenas dentro da rede Docker em desenvolvimento. Em produção, as configurações de acesso serão definidas via variáveis de ambiente.
- O projeto parte do zero (greenfield) — não há código existente além da estrutura inicial do repositório.
- O username é o identificador de login (não o e-mail). O campo e-mail existe na entidade User como dado de contato, mas não é usado para autenticação.
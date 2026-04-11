# Feature Specification: Database Health Check

**Feature Branch**: `010-db-health-check`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Adicionar health check de banco de dados na inicialização da aplicação — falhar rápido (fail fast) se o PostgreSQL não estiver acessível, em vez de subir e quebrar na primeira query"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inicialização segura com banco acessível (Priority: P1)

Como operador da aplicação, quero que ao iniciar o servidor, a aplicação verifique automaticamente a conectividade com o PostgreSQL antes de aceitar requisições. Se o banco estiver acessível, a aplicação inicia normalmente sem nenhum impacto perceptível para o usuário final.

**Why this priority**: Este é o caminho feliz — a aplicação deve validar a conexão com o banco em toda inicialização. Sem essa verificação, falhas silenciosas podem ocorrer na primeira query de um usuário real.

**Independent Test**: Pode ser testado iniciando a aplicação com o PostgreSQL rodando e verificando que ela aceita requisições normalmente após a verificação de saúde.

**Acceptance Scenarios**:

1. **Given** o PostgreSQL está acessível e respondendo, **When** a aplicação inicia, **Then** a verificação de saúde é concluída com sucesso e a aplicação aceita requisições normalmente.
2. **Given** o PostgreSQL está acessível, **When** a aplicação inicia, **Then** um log de confirmação é emitido indicando que a conexão com o banco foi verificada com sucesso.

---

### User Story 2 - Falha rápida com banco inacessível (Priority: P1)

Como operador da aplicação, quero que se o PostgreSQL não estiver acessível durante a inicialização, a aplicação falhe imediatamente com uma mensagem de erro clara, em vez de subir e quebrar na primeira query de um usuário.

**Why this priority**: Este é o cenário crítico que motivou a feature — evitar que a aplicação suba em estado degradado e quebre silenciosamente.

**Independent Test**: Pode ser testado iniciando a aplicação com o PostgreSQL desligado e verificando que ela falha com mensagem de erro clara e código de saída diferente de zero.

**Acceptance Scenarios**:

1. **Given** o PostgreSQL não está acessível (serviço desligado ou host incorreto), **When** a aplicação tenta iniciar, **Then** ela realiza até 3 tentativas de conexão (com intervalo de 2 segundos) e falha antes de aceitar qualquer requisição.
2. **Given** o PostgreSQL não está acessível, **When** a aplicação tenta iniciar, **Then** uma mensagem de erro clara é exibida indicando que o banco de dados não está acessível, incluindo o motivo da falha.
3. **Given** o PostgreSQL não está acessível, **When** a aplicação tenta iniciar, **Then** o processo encerra com código de saída diferente de zero, sinalizando falha para orquestradores (Docker, PM2, systemd).

---

### User Story 3 - Endpoint de saúde para monitoramento externo (Priority: P2)

Como operador da aplicação, quero ter um endpoint HTTP de health check que verifique a conectividade com o banco de dados em tempo real, para que ferramentas de monitoramento e balanceadores de carga possam verificar se a aplicação está saudável.

**Why this priority**: Complementa a verificação de inicialização, permitindo monitoramento contínuo em produção. Menos crítico que a verificação de startup, pois o cenário de "subir quebrado" já está coberto pelas stories P1.

**Independent Test**: Pode ser testado chamando o endpoint com o banco acessível (resposta de sucesso) e com o banco inacessível (resposta de falha com status apropriado).

**Acceptance Scenarios**:

1. **Given** a aplicação está rodando e o PostgreSQL está acessível, **When** uma requisição é feita ao endpoint de saúde, **Then** a resposta indica que a aplicação está saudável.
2. **Given** a aplicação está rodando mas o PostgreSQL ficou inacessível, **When** uma requisição é feita ao endpoint de saúde, **Then** a resposta indica que a aplicação não está saudável, com indicação de qual componente falhou.
3. **Given** a aplicação está rodando, **When** uma requisição é feita ao endpoint de saúde, **Then** a resposta inclui informações básicas de status (saudável/não saudável) sem expor detalhes sensíveis (credenciais, connection string, versão do banco).

---

### Edge Cases

- O que acontece quando o banco de dados está acessível mas lento para responder? A verificação deve ter um timeout para não bloquear a inicialização indefinidamente.
- O que acontece quando a connection string está malformada? A verificação deve reportar o erro de forma clara sem expor a string completa.
- O que acontece quando o banco está acessível mas as credenciais estão incorretas? A verificação deve diferenciar problemas de conectividade de problemas de autenticação na mensagem de erro.
- O que acontece quando o banco está acessível mas as migrations não foram aplicadas? O health check de inicialização verifica apenas conectividade, não o estado do schema.

## Clarifications

### Session 2026-04-10

- Q: O health check de inicialização deve tentar apenas uma vez ou realizar retries antes de falhar? → A: Retry limitado — até 3 tentativas com intervalo de 2 segundos entre elas (total ~6s).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Sistema DEVE verificar a conectividade com o banco de dados durante a inicialização, antes de aceitar qualquer requisição HTTP.
- **FR-002**: Sistema DEVE realizar até 3 tentativas de conexão com o banco de dados durante a inicialização, com intervalo de 2 segundos entre elas. Se todas falharem, o processo deve encerrar com código de saída diferente de zero.
- **FR-003**: Sistema DEVE emitir uma mensagem de erro clara e acionável quando a verificação de saúde falhar, indicando o tipo de problema (conexão recusada, timeout, autenticação, etc.) sem expor credenciais ou connection strings.
- **FR-004**: Sistema DEVE emitir um log de confirmação quando a verificação de saúde do banco for concluída com sucesso durante a inicialização.
- **FR-005**: Sistema DEVE respeitar um timeout para a verificação de inicialização, falhando se o banco não responder dentro do limite.
- **FR-006**: Sistema DEVE expor um endpoint HTTP de health check que verifica a conectividade com o banco de dados em tempo real.
- **FR-007**: O endpoint de health check DEVE retornar status de sucesso quando o banco estiver acessível e status de erro quando não estiver.
- **FR-008**: O endpoint de health check NÃO DEVE expor informações sensíveis (credenciais, connection strings, versões de software, detalhes de infraestrutura).
- **FR-009**: O endpoint de health check DEVE ser acessível sem autenticação, para permitir uso por balanceadores de carga e ferramentas de monitoramento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Aplicação com banco inacessível falha em até 10 segundos após a tentativa de inicialização (3 tentativas com intervalo de 2 segundos), sem aceitar nenhuma requisição.
- **SC-002**: Aplicação com banco acessível completa a verificação de saúde e aceita requisições sem atraso perceptível (verificação adiciona menos de 2 segundos ao tempo de inicialização).
- **SC-003**: Mensagem de erro em caso de falha permite ao operador identificar e corrigir o problema sem consultar documentação adicional (erro indica claramente a causa: conexão recusada, timeout, autenticação).
- **SC-004**: Endpoint de health check responde em menos de 3 segundos quando o banco está acessível.
- **SC-005**: Endpoint de health check não expõe nenhuma informação que possa ser usada para atacar a infraestrutura (verificável por inspeção da resposta).

## Assumptions

- O PostgreSQL é o único serviço externo crítico que precisa de verificação na inicialização. Outros serviços (caso existam no futuro) podem ser adicionados incrementalmente.
- O timeout padrão de 5 segundos para a verificação de inicialização é suficiente para ambientes de desenvolvimento e produção. Pode ser configurável via variável de ambiente.
- O pool de conexões existente será reutilizado para a verificação — não há necessidade de criar uma conexão separada.
- A verificação de inicialização utiliza uma query simples de conectividade que não depende do estado do schema ou das migrations.
- O endpoint de health check será acessível publicamente (sem autenticação), seguindo o padrão da indústria para integração com load balancers e orquestradores.
- O Docker Compose já possui um healthcheck no container do PostgreSQL, mas a verificação no nível da aplicação é complementar e necessária para cenários onde a aplicação roda fora do Docker ou o healthcheck do container não é suficiente.
